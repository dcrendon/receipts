import { ProviderName } from "../providers/types.ts";
import { ProviderRunResult } from "../core/run_status.ts";

export type ActivityBucket = "completed" | "active" | "blocked" | "other";

export interface NormalizedIssue {
  id: string;
  provider: ProviderName;
  sourceId: string;
  key: string;
  title: string;
  state: string;
  bucket: ActivityBucket;
  createdAt: string;
  updatedAt: string;
  author?: string;
  assignees: string[];
  labels: string[];
  commentCount: number;
  contributedByUser: boolean;
  isAuthoredByUser: boolean;
  isAssignedToUser: boolean;
  isCommentedByUser: boolean;
  userCommentCount: number;
  commentTimestamps: string[];
  description: string;
  descriptionSnippet: string;
  project: string;
  url?: string;
}

export interface ContributionSummary {
  contributedIssues: number;
  authoredIssues: number;
  assignedIssues: number;
  commentedIssues: number;
  totalUserComments: number;
}

export interface ReportSummary {
  totalIssues: number;
  byProvider: Record<ProviderName, number>;
  byState: Record<string, number>;
  byBucket: Record<ActivityBucket, number>;
  contribution: ContributionSummary;
}

export interface RunReport {
  normalizedIssues: NormalizedIssue[];
  summary: ReportSummary;
  coverage: ReportCoverageSummary;
  providerDistribution: Array<{ provider: ProviderName; count: number }>;
  html: string;
  context: { startDate: string; endDate: string };
}

export interface ReportContext {
  startDate: string;
  endDate: string;
  generatedAt?: string;
  sourceMode?: "fetch" | "report";
  geminiApiKey: string;
  usernames?: Partial<Record<ProviderName, string>>;
}

export interface ReportCoverageSummary {
  sourceMode: "fetch" | "report";
  requestedProviders: ProviderName[];
  successfulProviders: ProviderName[];
  failedProviders: ProviderName[];
  connectedProviderCount: number;
  totalProviderCount: number;
  partialFailures: number;
}

export interface ReportBuildOptions {
  diagnostics?: {
    sourceMode?: "fetch" | "report";
    requestedProviders?: ProviderName[];
    runResults?: ProviderRunResult[];
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

export const toStringOrEmpty = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
};

const parseTimestamp = (value: string): number => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const compareUpdatedAtDesc = (a: string, b: string): number => {
  const aMs = parseTimestamp(a);
  const bMs = parseTimestamp(b);
  if (aMs !== bMs) return bMs - aMs;
  return b.localeCompare(a);
};

const normalizeIdentity = (value: string): string =>
  value.trim().toLowerCase().replace(/^@+/, "");

const parseIdentityValue = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number") return String(value);
  return undefined;
};

export const collectIdentityCandidates = (actor: unknown): string[] => {
  if (!actor || typeof actor !== "object") return [];

  const candidateFields = [
    "username",
    "login",
    "name",
    "displayName",
    "emailAddress",
    "accountId",
    "id",
  ] as const;

  const values = new Set<string>();
  for (const field of candidateFields) {
    const candidate = parseIdentityValue(
      (actor as Record<string, unknown>)[field],
    );
    if (candidate) values.add(candidate);
  }
  return [...values];
};

export const matchesAttributionUser = (
  username: string | undefined,
  candidates: string[],
): boolean => {
  if (!username) return false;
  const target = normalizeIdentity(username);
  return candidates.some((c) => normalizeIdentity(c) === target);
};

const stringifyTextTree = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((e) => stringifyTextTree(e)).join(" ");
  }
  if (!value || typeof value !== "object") return "";
  const r = value as Record<string, unknown>;
  const directText = parseIdentityValue(r.text);
  const nested = stringifyTextTree(r.content);
  return [directText ?? "", nested].filter(Boolean).join(" ");
};

const toDescription = (value: unknown): string =>
  stringifyTextTree(value).replace(/\s+/g, " ").trim();

const toDescriptionSnippet = (value: unknown, maxLength = 420): string => {
  const normalized = toDescription(value);
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
};

const bucketFromState = (state: string): ActivityBucket => {
  const normalized = state.trim().toLowerCase().replace(/[\-_]+/g, " ");

  if (
    /(done|closed|resolved|complete|completed|fixed|merged|shipped|released|deployed|accepted|cancelled|canceled)/
      .test(normalized)
  ) return "completed";

  if (
    /(blocked|on hold|onhold|stuck|waiting|impediment|dependency|needs info)/
      .test(normalized)
  ) return "blocked";

  if (
    /(open|opened|in progress|in review|in testing|review|todo|to do|backlog|selected|working)/
      .test(normalized)
  ) return "active";

  return "other";
};

/* ------------------------------------------------------------------ */
/*  Per-provider normalizers                                            */
/* ------------------------------------------------------------------ */

const normalizeGitLabIssue = (
  raw: Record<string, unknown>,
  attributionUsername?: string,
): NormalizedIssue => {
  const sourceId = toStringOrEmpty(raw.id);
  const iid = toStringOrEmpty(raw.iid);
  const notes = Array.isArray(raw.notes) ? raw.notes : [];
  const author = raw.author;
  const assignees = Array.isArray(raw.assignees) ? raw.assignees : [];

  const isAuthoredByUser = matchesAttributionUser(
    attributionUsername,
    collectIdentityCandidates(author),
  );

  const isAssignedToUser = assignees.some((a) =>
    matchesAttributionUser(attributionUsername, collectIdentityCandidates(a))
  );

  const userNotes = notes.filter((note) =>
    matchesAttributionUser(
      attributionUsername,
      collectIdentityCandidates(
        (note as Record<string, unknown>).author ??
          (note as Record<string, unknown>).user,
      ),
    )
  );

  const userCommentCount = userNotes.length;
  const isCommentedByUser = userCommentCount > 0;

  const commentTimestamps = userNotes
    .map((note) =>
      toStringOrEmpty((note as Record<string, unknown>).created_at)
    )
    .filter(Boolean);

  const state = toStringOrEmpty(raw.state) || "unknown";
  const webUrl = toStringOrEmpty(raw.web_url);

  // Extract project from web_url: https://gitlab.com/group/project/-/issues/42
  let project = "";
  try {
    const url = new URL(webUrl);
    const parts = url.pathname.split("/-/")[0].replace(/^\//, "");
    project = parts || "gitlab";
  } catch {
    project = "gitlab";
  }

  return {
    id: `gitlab:${sourceId}`,
    provider: "gitlab",
    sourceId,
    key: iid ? `GL-${iid}` : sourceId,
    title: toStringOrEmpty(raw.title) || "(untitled)",
    state,
    bucket: bucketFromState(state),
    createdAt: toStringOrEmpty(raw.created_at),
    updatedAt: toStringOrEmpty(raw.updated_at),
    author: toStringOrEmpty(
      (author as Record<string, unknown>)?.username ??
        (author as Record<string, unknown>)?.name,
    ),
    assignees: assignees
      .map((a) =>
        toStringOrEmpty(
          (a as Record<string, unknown>)?.username ??
            (a as Record<string, unknown>)?.name,
        )
      )
      .filter(Boolean),
    labels: Array.isArray(raw.labels)
      ? raw.labels.map((l) => toStringOrEmpty(l)).filter(Boolean)
      : [],
    commentCount: notes.length,
    contributedByUser: isAuthoredByUser || isAssignedToUser ||
      isCommentedByUser,
    isAuthoredByUser,
    isAssignedToUser,
    isCommentedByUser,
    userCommentCount,
    commentTimestamps,
    description: toDescription(raw.description),
    descriptionSnippet: toDescriptionSnippet(raw.description),
    project,
    url: webUrl,
  };
};

const normalizeJiraIssue = (
  raw: Record<string, unknown>,
  attributionUsername?: string,
): NormalizedIssue => {
  const fields = (raw.fields ?? {}) as Record<string, unknown>;
  const sourceId = toStringOrEmpty(raw.id);
  const notes = Array.isArray(raw.notes) ? raw.notes : [];
  const assignee = fields.assignee;
  const reporter = fields.reporter;

  const isAuthoredByUser = matchesAttributionUser(
    attributionUsername,
    collectIdentityCandidates(reporter),
  );

  const isAssignedToUser = matchesAttributionUser(
    attributionUsername,
    collectIdentityCandidates(assignee),
  );

  const userNotes = notes.filter((note) =>
    matchesAttributionUser(
      attributionUsername,
      collectIdentityCandidates((note as Record<string, unknown>).author),
    )
  );

  const userCommentCount = userNotes.length;
  const isCommentedByUser = userCommentCount > 0;

  const commentTimestamps = userNotes
    .map((note) => toStringOrEmpty((note as Record<string, unknown>).created))
    .filter(Boolean);

  const state = toStringOrEmpty(
    ((fields.status ?? {}) as Record<string, unknown>).name,
  ) || "unknown";

  const issueKey = toStringOrEmpty(raw.key) || sourceId;
  const project = issueKey.replace(/-\d+$/, "") || "jira";

  return {
    id: `jira:${sourceId}`,
    provider: "jira",
    sourceId,
    key: issueKey,
    title: toStringOrEmpty(fields.summary) || "(untitled)",
    state,
    bucket: bucketFromState(state),
    createdAt: toStringOrEmpty(fields.created),
    updatedAt: toStringOrEmpty(fields.updated),
    author: toStringOrEmpty(
      ((reporter ?? {}) as Record<string, unknown>).displayName ??
        ((reporter ?? {}) as Record<string, unknown>).name,
    ),
    assignees: parseIdentityValue(
        ((assignee ?? {}) as Record<string, unknown>).displayName ??
          ((assignee ?? {}) as Record<string, unknown>).name,
      )
      ? [
        toStringOrEmpty(
          ((assignee ?? {}) as Record<string, unknown>).displayName ??
            ((assignee ?? {}) as Record<string, unknown>).name,
        ),
      ]
      : [],
    labels: Array.isArray(fields.labels)
      ? fields.labels.map((l) => toStringOrEmpty(l)).filter(Boolean)
      : [],
    commentCount: notes.length,
    contributedByUser: isAuthoredByUser || isAssignedToUser ||
      isCommentedByUser,
    isAuthoredByUser,
    isAssignedToUser,
    isCommentedByUser,
    userCommentCount,
    commentTimestamps,
    description: toDescription(fields.description),
    descriptionSnippet: toDescriptionSnippet(fields.description),
    project,
    url: toStringOrEmpty(raw.self),
  };
};

const normalizeGitHubIssue = (
  raw: Record<string, unknown>,
  attributionUsername?: string,
): NormalizedIssue => {
  const sourceId = toStringOrEmpty(raw.id);
  const notes = Array.isArray(raw.notes) ? raw.notes : [];
  const assignees = Array.isArray(raw.assignees) ? raw.assignees : [];

  const isAuthoredByUser = matchesAttributionUser(
    attributionUsername,
    collectIdentityCandidates(raw.user),
  );

  const isAssignedToUser = assignees.some((a) =>
    matchesAttributionUser(attributionUsername, collectIdentityCandidates(a))
  );

  const userNotes = notes.filter((note) =>
    matchesAttributionUser(
      attributionUsername,
      collectIdentityCandidates((note as Record<string, unknown>).user),
    )
  );

  const userCommentCount = userNotes.length;
  const isCommentedByUser = userCommentCount > 0;

  const commentTimestamps = userNotes
    .map((note) =>
      toStringOrEmpty((note as Record<string, unknown>).created_at)
    )
    .filter(Boolean);

  const state = toStringOrEmpty(raw.state) || "unknown";

  const labels = Array.isArray(raw.labels)
    ? raw.labels
      .map((l) => toStringOrEmpty((l as Record<string, unknown>)?.name ?? l))
      .filter(Boolean)
    : [];

  const commentsValue = raw.comments;
  const numericComments = typeof commentsValue === "number"
    ? commentsValue
    : Number.NaN;

  const metadata = raw.metadata as Record<string, unknown> | undefined;
  const project = toStringOrEmpty(metadata?.repository) || "github";

  return {
    id: `github:${sourceId}`,
    provider: "github",
    sourceId,
    key: toStringOrEmpty(raw.number)
      ? `GH-${toStringOrEmpty(raw.number)}`
      : sourceId,
    title: toStringOrEmpty(raw.title) || "(untitled)",
    state,
    bucket: bucketFromState(state),
    createdAt: toStringOrEmpty(raw.created_at),
    updatedAt: toStringOrEmpty(raw.updated_at),
    author: toStringOrEmpty(
      ((raw.user ?? {}) as Record<string, unknown>).login,
    ),
    assignees: assignees
      .map((a) => toStringOrEmpty(((a ?? {}) as Record<string, unknown>).login))
      .filter(Boolean),
    labels,
    commentCount: Number.isFinite(numericComments)
      ? numericComments
      : notes.length,
    contributedByUser: isAuthoredByUser || isAssignedToUser ||
      isCommentedByUser,
    isAuthoredByUser,
    isAssignedToUser,
    isCommentedByUser,
    userCommentCount,
    commentTimestamps,
    description: toDescription(raw.body),
    descriptionSnippet: toDescriptionSnippet(raw.body),
    project,
    url: toStringOrEmpty(raw.html_url),
  };
};

/* ------------------------------------------------------------------ */
/*  Public API                                                          */
/* ------------------------------------------------------------------ */

export const normalizeProviderIssues = (
  provider: ProviderName,
  issues: unknown[],
  attributionUsername?: string,
): NormalizedIssue[] => {
  if (provider === "gitlab") {
    return issues.map((i) =>
      normalizeGitLabIssue(i as Record<string, unknown>, attributionUsername)
    );
  }
  if (provider === "jira") {
    return issues.map((i) =>
      normalizeJiraIssue(i as Record<string, unknown>, attributionUsername)
    );
  }
  return issues.map((i) =>
    normalizeGitHubIssue(i as Record<string, unknown>, attributionUsername)
  );
};

export const buildReportSummary = (
  normalizedIssues: NormalizedIssue[],
): ReportSummary => {
  const byProvider: Record<ProviderName, number> = {
    gitlab: 0,
    jira: 0,
    github: 0,
  };

  const byState: Record<string, number> = {};
  const byBucket: Record<ActivityBucket, number> = {
    completed: 0,
    active: 0,
    blocked: 0,
    other: 0,
  };

  let contributedIssues = 0;
  let authoredIssues = 0;
  let assignedIssues = 0;
  let commentedIssues = 0;
  let totalUserComments = 0;

  for (const issue of normalizedIssues) {
    byProvider[issue.provider] += 1;
    byState[issue.state] = (byState[issue.state] ?? 0) + 1;
    byBucket[issue.bucket] += 1;

    if (issue.contributedByUser) contributedIssues += 1;
    if (issue.isAuthoredByUser) authoredIssues += 1;
    if (issue.isAssignedToUser) assignedIssues += 1;
    if (issue.isCommentedByUser) commentedIssues += 1;
    totalUserComments += issue.userCommentCount;
  }

  return {
    totalIssues: normalizedIssues.length,
    byProvider,
    byState,
    byBucket,
    contribution: {
      contributedIssues,
      authoredIssues,
      assignedIssues,
      commentedIssues,
      totalUserComments,
    },
  };
};

export const buildCoverageSummary = (
  summary: ReportSummary,
  diagnostics?: ReportBuildOptions["diagnostics"],
): ReportCoverageSummary => {
  const sourceMode = diagnostics?.sourceMode ?? "report";
  const requestedProviders = diagnostics?.requestedProviders?.length
    ? diagnostics.requestedProviders
    : (["gitlab", "jira", "github"] as ProviderName[]);

  const runResults = diagnostics?.runResults ?? [];
  const successfulProviders = runResults
    .filter((r) => r.status === "success")
    .map((r) => r.provider);
  const failedProviders = runResults
    .filter((r) => r.status === "failed")
    .map((r) => r.provider);

  const connectedProviderCount =
    requestedProviders.filter((p) =>
      summary.byProvider[p] > 0 || successfulProviders.includes(p)
    ).length;

  return {
    sourceMode,
    requestedProviders,
    successfulProviders,
    failedProviders,
    connectedProviderCount,
    totalProviderCount: requestedProviders.length,
    partialFailures: failedProviders.length,
  };
};

export const buildProviderDistribution = (
  byProvider: ReportSummary["byProvider"],
): Array<{ provider: ProviderName; count: number }> =>
  (["gitlab", "jira", "github"] as ProviderName[]).map((p) => ({
    provider: p,
    count: byProvider[p],
  }));

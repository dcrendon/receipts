import { ProviderName } from "../providers/types.ts";
import { ProviderRunResult } from "../core/run_status.ts";
import {
  AiNarrativeMode,
  ReportFormat,
  ReportProfile,
} from "../shared/types.ts";
import { AiNarrativeResult, applyAiNarrativeRewrite } from "./ai_narrative.ts";

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
  impactScore: number;
  description: string;
  descriptionSnippet: string;
  url?: string;
}

export interface ReportIssueView {
  provider: ProviderName;
  key: string;
  title: string;
  state: string;
  bucket: ActivityBucket;
  impactScore: number;
  updatedAt: string;
  userCommentCount: number;
  isAuthoredByUser: boolean;
  isAssignedToUser: boolean;
  isCommentedByUser: boolean;
  labels: string[];
  descriptionSnippet: string;
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
  topLabels: Array<{ label: string; count: number }>;
  highPriorityLabelIssues: number;
  contribution: ContributionSummary;
  topActivityHighlights: ReportIssueView[];
  collaborationHighlights: ReportIssueView[];
  risksAndFollowUps: ReportIssueView[];
  latestUpdated: ReportIssueView[];
}

export interface WeeklyTalkingPoint {
  lead: string;
  bullets: string[];
}

export interface NarrativeSections {
  executiveHeadline: string;
  topHighlightWording: string[];
  collaborationHighlights: string[];
  risksAndFollowUps: string[];
  weeklyTalkingPoints: WeeklyTalkingPoint[];
  aiAssisted: {
    executiveHeadline: boolean;
    topHighlights: boolean;
    weeklyTalkingPoints: boolean;
  };
}

export interface RunReport {
  normalizedIssues: NormalizedIssue[];
  summary: ReportSummary;
  coverage: ReportCoverageSummary;
  providerDistribution: Array<{ provider: ProviderName; count: number }>;
  markdown: string;
  html: string;
  reportFormat: ReportFormat;
  narrative: NarrativeSections;
  context: { startDate: string; endDate: string };
}

export interface ReportContext {
  startDate: string;
  endDate: string;
  fetchMode: string;
  reportProfile: ReportProfile;
  reportFormat: ReportFormat;
  aiNarrative: AiNarrativeMode;
  aiModel: string;
  generatedAt?: string;
  sourceMode?: "fetch" | "report";
  openaiApiKey?: string;
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

const PROFILE_SETTINGS: Record<
  ReportProfile,
  {
    topHighlights: number;
    collaboration: number;
    risks: number;
    appendix: number;
    talkingPoints: number;
  }
> = {
  brief: {
    topHighlights: 3,
    collaboration: 2,
    risks: 2,
    appendix: 10,
    talkingPoints: 3,
  },
  activity_retro: {
    topHighlights: 5,
    collaboration: 3,
    risks: 3,
    appendix: 20,
    talkingPoints: 5,
  },
  showcase: {
    topHighlights: 7,
    collaboration: 4,
    risks: 4,
    appendix: 30,
    talkingPoints: 6,
  },
};

const HIGH_IMPACT_LABEL_HINTS = [
  "sev",
  "incident",
  "security",
  "customer",
  "prod",
  "revenue",
] as const;

const toStringOrEmpty = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
};

const parseTimestamp = (value: string): number => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const compareUpdatedAtDesc = (a: string, b: string): number => {
  const aMs = parseTimestamp(a);
  const bMs = parseTimestamp(b);
  if (aMs !== bMs) {
    return bMs - aMs;
  }
  return b.localeCompare(a);
};

const normalizeIdentity = (value: string): string => {
  return value.trim().toLowerCase().replace(/^@+/, "");
};

const parseIdentityValue = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return undefined;
};

const collectIdentityCandidates = (actor: unknown): string[] => {
  if (!actor || typeof actor !== "object") {
    return [];
  }

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
    if (candidate) {
      values.add(candidate);
    }
  }
  return [...values];
};

const matchesAttributionUser = (
  username: string | undefined,
  candidates: string[],
): boolean => {
  if (!username) return false;
  const target = normalizeIdentity(username);
  return candidates.some((candidate) =>
    normalizeIdentity(candidate) === target
  );
};

const stringifyTextTree = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => stringifyTextTree(entry)).join(" ");
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const asRecord = value as Record<string, unknown>;
  const directText = parseIdentityValue(asRecord.text);
  const nested = stringifyTextTree(asRecord.content);
  return [directText ?? "", nested].filter(Boolean).join(" ");
};

const toDescription = (value: unknown): string => {
  const normalized = stringifyTextTree(value)
    .replace(/\s+/g, " ")
    .trim();
  return normalized;
};

const toDescriptionSnippet = (value: unknown, maxLength = 420): string => {
  const normalized = toDescription(value);
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
};

const bucketFromState = (state: string): ActivityBucket => {
  const normalized = state.trim().toLowerCase().replace(/[\-_]+/g, " ");

  if (
    /(done|closed|resolved|complete|completed|fixed|merged|shipped|released|deployed)/
      .test(normalized)
  ) {
    return "completed";
  }

  if (
    /(blocked|on hold|onhold|stuck|waiting|impediment|dependency|needs info)/
      .test(normalized)
  ) {
    return "blocked";
  }

  if (
    /(open|opened|in progress|in review|review|todo|to do|backlog|selected|working)/
      .test(normalized)
  ) {
    return "active";
  }

  return "other";
};

const hasHighImpactLabels = (labels: string[]): boolean => {
  return labels.some((label) => {
    const normalized = label.trim().toLowerCase();
    if (!normalized) return false;
    if (/\bp0\b/.test(normalized) || /\bp1\b/.test(normalized)) {
      return true;
    }
    return HIGH_IMPACT_LABEL_HINTS.some((hint) => normalized.includes(hint));
  });
};

const scoreIssue = (
  issue: NormalizedIssue,
  windowEndMs?: number,
): number => {
  let score = 0;

  if (issue.bucket === "completed") score += 40;
  else if (issue.bucket === "active") score += 20;
  else if (issue.bucket === "blocked") score += 10;

  if (issue.isAuthoredByUser) score += 15;
  if (issue.isAssignedToUser) score += 10;

  score += Math.min(issue.userCommentCount * 2, 10);

  if (hasHighImpactLabels(issue.labels)) {
    score += 12;
  }

  if (windowEndMs) {
    const updatedAtMs = parseTimestamp(issue.updatedAt);
    const hours48 = 48 * 60 * 60 * 1000;
    if (
      updatedAtMs > 0 &&
      updatedAtMs <= windowEndMs &&
      updatedAtMs >= windowEndMs - hours48
    ) {
      score += 8;
    }
  }

  return score;
};

const compareIssues = (a: NormalizedIssue, b: NormalizedIssue): number => {
  if (a.impactScore !== b.impactScore) {
    return b.impactScore - a.impactScore;
  }

  const updatedDiff = compareUpdatedAtDesc(a.updatedAt, b.updatedAt);
  if (updatedDiff !== 0) {
    return updatedDiff;
  }

  const keyDiff = a.key.localeCompare(b.key);
  if (keyDiff !== 0) {
    return keyDiff;
  }

  return a.provider.localeCompare(b.provider);
};

const toIssueView = (issue: NormalizedIssue): ReportIssueView => ({
  provider: issue.provider,
  key: issue.key,
  title: issue.title,
  state: issue.state,
  bucket: issue.bucket,
  impactScore: issue.impactScore,
  updatedAt: issue.updatedAt,
  userCommentCount: issue.userCommentCount,
  isAuthoredByUser: issue.isAuthoredByUser,
  isAssignedToUser: issue.isAssignedToUser,
  isCommentedByUser: issue.isCommentedByUser,
  labels: issue.labels,
  descriptionSnippet: issue.descriptionSnippet,
  url: issue.url,
});

const formatProvider = (provider: ProviderName): string => {
  if (provider === "gitlab") return "GitLab";
  if (provider === "jira") return "Jira";
  return "GitHub";
};

const HUMAN_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const HUMAN_DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

const formatHumanDateTime = (value: string): string => {
  const parsed = parseTimestamp(value);
  if (parsed <= 0) {
    return value;
  }
  return HUMAN_DATE_TIME_FORMAT.format(new Date(parsed));
};

const formatHumanDate = (value: string): string => {
  const parsed = parseTimestamp(value);
  if (parsed <= 0) {
    return value;
  }
  return HUMAN_DATE_FORMAT.format(new Date(parsed));
};

const summarizeFollowUpAction = (issue: ReportIssueView): string => {
  const snippet = issue.descriptionSnippet.replace(/\s+/g, " ").trim();
  if (snippet.length > 0) {
    const firstSentence = snippet.split(/[.!?]/)[0]?.trim();
    if (firstSentence) {
      return firstSentence.endsWith(".") ? firstSentence : `${firstSentence}.`;
    }
  }

  if (issue.bucket === "blocked") {
    return "Remove blocker, confirm owner, and set a next checkpoint date.";
  }
  if (issue.bucket === "active") {
    return "Confirm the next deliverable and lock a completion date.";
  }
  return "Confirm owner and next action in the next status checkpoint.";
};

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

  const isAssignedToUser = assignees.some((assignee) =>
    matchesAttributionUser(
      attributionUsername,
      collectIdentityCandidates(assignee),
    )
  );

  const userCommentCount = notes.filter((note) =>
    matchesAttributionUser(
      attributionUsername,
      collectIdentityCandidates(
        (note as Record<string, unknown>).author ??
          (note as Record<string, unknown>).user,
      ),
    )
  ).length;

  const isCommentedByUser = userCommentCount > 0;

  const state = toStringOrEmpty(raw.state) || "unknown";
  const bucket = bucketFromState(state);

  return {
    id: `gitlab:${sourceId}`,
    provider: "gitlab",
    sourceId,
    key: iid ? `GL-${iid}` : sourceId,
    title: toStringOrEmpty(raw.title) || "(untitled)",
    state,
    bucket,
    createdAt: toStringOrEmpty(raw.created_at),
    updatedAt: toStringOrEmpty(raw.updated_at),
    author: toStringOrEmpty(
      (author as Record<string, unknown>)?.username ??
        (author as Record<string, unknown>)?.name,
    ),
    assignees: assignees
      .map((assignee) =>
        toStringOrEmpty(
          (assignee as Record<string, unknown>)?.username ??
            (assignee as Record<string, unknown>)?.name,
        )
      )
      .filter(Boolean),
    labels: Array.isArray(raw.labels)
      ? raw.labels.map((label) => toStringOrEmpty(label)).filter(Boolean)
      : [],
    commentCount: notes.length,
    contributedByUser: isAuthoredByUser || isAssignedToUser ||
      isCommentedByUser,
    isAuthoredByUser,
    isAssignedToUser,
    isCommentedByUser,
    userCommentCount,
    impactScore: 0,
    description: toDescription(raw.description),
    descriptionSnippet: toDescriptionSnippet(raw.description),
    url: toStringOrEmpty(raw.web_url),
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

  const userCommentCount = notes.filter((note) =>
    matchesAttributionUser(
      attributionUsername,
      collectIdentityCandidates((note as Record<string, unknown>).author),
    )
  ).length;

  const isCommentedByUser = userCommentCount > 0;
  const state = toStringOrEmpty(
    ((fields.status ?? {}) as Record<string, unknown>).name,
  ) || "unknown";

  return {
    id: `jira:${sourceId}`,
    provider: "jira",
    sourceId,
    key: toStringOrEmpty(raw.key) || sourceId,
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
      ? fields.labels.map((label) => toStringOrEmpty(label)).filter(Boolean)
      : [],
    commentCount: notes.length,
    contributedByUser: isAuthoredByUser || isAssignedToUser ||
      isCommentedByUser,
    isAuthoredByUser,
    isAssignedToUser,
    isCommentedByUser,
    userCommentCount,
    impactScore: 0,
    description: toDescription(fields.description),
    descriptionSnippet: toDescriptionSnippet(fields.description),
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

  const isAssignedToUser = assignees.some((assignee) =>
    matchesAttributionUser(
      attributionUsername,
      collectIdentityCandidates(assignee),
    )
  );

  const userCommentCount = notes.filter((note) =>
    matchesAttributionUser(
      attributionUsername,
      collectIdentityCandidates((note as Record<string, unknown>).user),
    )
  ).length;

  const isCommentedByUser = userCommentCount > 0;
  const state = toStringOrEmpty(raw.state) || "unknown";

  const labels = Array.isArray(raw.labels)
    ? raw.labels
      .map((label) =>
        toStringOrEmpty((label as Record<string, unknown>)?.name ?? label)
      )
      .filter(Boolean)
    : [];

  const commentsValue = raw.comments;
  const numericComments = typeof commentsValue === "number"
    ? commentsValue
    : Number.NaN;

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
      .map((assignee) =>
        toStringOrEmpty(((assignee ?? {}) as Record<string, unknown>).login)
      )
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
    impactScore: 0,
    description: toDescription(raw.body),
    descriptionSnippet: toDescriptionSnippet(raw.body),
    url: toStringOrEmpty(raw.html_url),
  };
};

export const normalizeProviderIssues = (
  provider: ProviderName,
  issues: unknown[],
  attributionUsername?: string,
): NormalizedIssue[] => {
  if (provider === "gitlab") {
    return issues.map((issue) =>
      normalizeGitLabIssue(
        issue as Record<string, unknown>,
        attributionUsername,
      )
    );
  }

  if (provider === "jira") {
    return issues.map((issue) =>
      normalizeJiraIssue(issue as Record<string, unknown>, attributionUsername)
    );
  }

  return issues.map((issue) =>
    normalizeGitHubIssue(issue as Record<string, unknown>, attributionUsername)
  );
};

const selectReportViews = (
  sortedIssues: NormalizedIssue[],
  profile: ReportProfile,
): {
  topActivityHighlights: ReportIssueView[];
  collaborationHighlights: ReportIssueView[];
  risksAndFollowUps: ReportIssueView[];
  appendix: ReportIssueView[];
} => {
  const settings = PROFILE_SETTINGS[profile];

  const topActivityHighlights = sortedIssues
    .slice(0, settings.topHighlights)
    .map(toIssueView);

  const collaborationHighlights = sortedIssues
    .filter((issue) => issue.contributedByUser)
    .sort((a, b) => {
      if (a.userCommentCount !== b.userCommentCount) {
        return b.userCommentCount - a.userCommentCount;
      }
      return compareIssues(a, b);
    })
    .slice(0, settings.collaboration)
    .map(toIssueView);

  const risksAndFollowUps = sortedIssues
    .filter((issue) => {
      if (issue.bucket === "blocked") return true;
      if (hasHighImpactLabels(issue.labels) && issue.bucket !== "completed") {
        return true;
      }
      return issue.bucket === "active" && issue.impactScore >= 35;
    })
    .slice(0, settings.risks)
    .map(toIssueView);

  const appendix = sortedIssues
    .slice(0, settings.appendix)
    .map(toIssueView);

  return {
    topActivityHighlights,
    collaborationHighlights,
    risksAndFollowUps,
    appendix,
  };
};

export const buildReportSummary = (
  normalizedIssues: NormalizedIssue[],
  profile: ReportProfile = "activity_retro",
): ReportSummary => {
  const sortedIssues = [...normalizedIssues].sort(compareIssues);
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

  const labelCounts = new Map<string, number>();
  let highPriorityLabelIssues = 0;

  let contributedIssues = 0;
  let authoredIssues = 0;
  let assignedIssues = 0;
  let commentedIssues = 0;
  let totalUserComments = 0;

  for (const issue of sortedIssues) {
    byProvider[issue.provider] += 1;
    byState[issue.state] = (byState[issue.state] ?? 0) + 1;
    byBucket[issue.bucket] += 1;

    if (issue.contributedByUser) contributedIssues += 1;
    if (issue.isAuthoredByUser) authoredIssues += 1;
    if (issue.isAssignedToUser) assignedIssues += 1;
    if (issue.isCommentedByUser) commentedIssues += 1;
    totalUserComments += issue.userCommentCount;

    if (hasHighImpactLabels(issue.labels)) {
      highPriorityLabelIssues += 1;
    }

    for (const label of issue.labels) {
      labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
    }
  }

  const topLabels = [...labelCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => {
      if (a.count !== b.count) {
        return b.count - a.count;
      }
      return a.label.localeCompare(b.label);
    })
    .slice(0, 10);

  const latestUpdated = [...sortedIssues]
    .sort((a, b) => {
      const updatedDiff = compareUpdatedAtDesc(a.updatedAt, b.updatedAt);
      if (updatedDiff !== 0) return updatedDiff;
      return a.key.localeCompare(b.key);
    })
    .slice(0, 5)
    .map(toIssueView);

  const views = selectReportViews(sortedIssues, profile);

  return {
    totalIssues: sortedIssues.length,
    byProvider,
    byState,
    byBucket,
    topLabels,
    highPriorityLabelIssues,
    contribution: {
      contributedIssues,
      authoredIssues,
      assignedIssues,
      commentedIssues,
      totalUserComments,
    },
    topActivityHighlights: views.topActivityHighlights,
    collaborationHighlights: views.collaborationHighlights,
    risksAndFollowUps: views.risksAndFollowUps,
    latestUpdated,
  };
};

const firstSentenceFromSnippet = (value: string): string => {
  const snippet = value.replace(/\s+/g, " ").trim();
  if (!snippet) return "";
  const first = snippet.split(/[.!?]/)[0]?.trim() ?? "";
  return first;
};

const highlightNarrativeFallback = (issue: ReportIssueView): string => {
  const snippet = firstSentenceFromSnippet(issue.descriptionSnippet);

  if (issue.bucket === "completed") {
    return snippet
      ? `Closed ${issue.key}: ${snippet}.`
      : `${issue.key} (${issue.title}) completed, moved to ${issue.state}.`;
  }

  if (issue.bucket === "blocked") {
    return snippet
      ? `${issue.key} is blocked: ${snippet}. Needs follow-up.`
      : `${issue.key} (${issue.title}) is blocked in ${issue.state} and requires follow-up.`;
  }

  if (issue.bucket === "active") {
    return snippet
      ? `${issue.key} in progress: ${snippet}.`
      : `${issue.key} (${issue.title}) is actively being worked in ${issue.state}.`;
  }

  return snippet
    ? `${issue.key}: ${snippet}.`
    : `${issue.key} (${issue.title}) is in ${issue.state}.`;
};

const buildHeadlineLead = (
  summary: ReportSummary,
  _context: ReportContext,
): string => {
  if (summary.totalIssues === 0) {
    return "No ticket activity was captured in the selected reporting window.";
  }

  const parts: string[] = [];

  if (summary.byBucket.completed > 0) {
    const topCompleted = summary.topActivityHighlights.find((issue) =>
      issue.bucket === "completed"
    );
    parts.push(
      summary.byBucket.completed === 1 && topCompleted
        ? `Completed ${topCompleted.key}`
        : `Completed ${summary.byBucket.completed} item${summary.byBucket.completed > 1 ? "s" : ""}`,
    );
  }

  if (summary.byBucket.active > 0) {
    parts.push(`${summary.byBucket.active} in progress`);
  }

  if (summary.byBucket.blocked > 0) {
    parts.push(`${summary.byBucket.blocked} blocked`);
  }

  if (!parts.length) {
    return `${summary.totalIssues} issue${summary.totalIssues > 1 ? "s" : ""} tracked this window.`;
  }

  return parts.join(", ") + ".";
};

const buildDeterministicNarrative = (
  summary: ReportSummary,
  context: ReportContext,
  coverage?: ReportCoverageSummary,
): {
  headlineLead: string;
  headlineFacts: string;
  topHighlightWording: string[];
  collaborationHighlights: string[];
  risksAndFollowUps: string[];
  weeklyPointLeads: string[];
  weeklyPointBullets: string[][];
} => {
  const providerCount = coverage ? coverage.connectedProviderCount : [
    summary.byProvider.gitlab,
    summary.byProvider.jira,
    summary.byProvider.github,
  ].filter((count) => count > 0).length;

  const headlineLead = buildHeadlineLead(summary, context);

  const headlineFacts = summary.totalIssues === 0
    ? `No issues found across ${providerCount} connected provider${
      providerCount === 1 ? "" : "s"
    }; ${summary.byBucket.completed} completed, ${summary.byBucket.active} active, ${summary.byBucket.blocked} blocked.`
    : `${summary.totalIssues} issues across ${providerCount} provider${
      providerCount === 1 ? "" : "s"
    }; ${summary.byBucket.completed} completed, ${summary.byBucket.active} active, ${summary.byBucket.blocked} blocked.`;

  const topHighlightWording = summary.topActivityHighlights.map((issue) =>
    highlightNarrativeFallback(issue)
  );

  const collaborationHighlights = summary.collaborationHighlights.map(
    (issue) => {
      const actions: string[] = [];
      if (issue.isAuthoredByUser) actions.push("authored");
      if (issue.isAssignedToUser) actions.push("assigned");
      if (issue.isCommentedByUser) {
        actions.push(
          `${issue.userCommentCount} comment${issue.userCommentCount > 1 ? "s" : ""}`,
        );
      }

      return `${issue.key}: ${actions.join(", ") || "contributed"} (${formatProvider(issue.provider)}, ${issue.bucket}).`;
    },
  );

  const risksAndFollowUps = summary.risksAndFollowUps.map((issue) => {
    return `[${formatProvider(issue.provider)} ${issue.key}] ${
      summarizeFollowUpAction(issue)
    }`;
  });

  const topLabel = summary.topLabels[0]?.label;
  const strongest = summary.topActivityHighlights[0];

  const activeProviders = (["gitlab", "jira", "github"] as const)
    .filter((p) => summary.byProvider[p] > 0)
    .map(formatProvider);

  const recentWindowCutoff = parseTimestamp(context.endDate) -
    (48 * 60 * 60 * 1000);
  const recentCount = summary.latestUpdated.filter((issue) => {
    const updatedAtMs = parseTimestamp(issue.updatedAt);
    return updatedAtMs > 0 && updatedAtMs >= recentWindowCutoff;
  }).length;

  const weeklyPointLeads = [
    `${summary.byBucket.completed} completed, ${summary.byBucket.active} active, ${summary.byBucket.blocked} blocked this window.`,
    providerCount > 1
      ? `Activity spans ${providerCount} providers: ${activeProviders.join(", ")}.`
      : `All activity from ${activeProviders[0] ?? "1 provider"}.`,
    summary.contribution.contributedIssues > 0
      ? `User contributed to ${summary.contribution.contributedIssues} issue${summary.contribution.contributedIssues > 1 ? "s" : ""} with ${summary.contribution.totalUserComments} comment${summary.contribution.totalUserComments !== 1 ? "s" : ""}.`
      : "No direct user contribution detected this window.",
    summary.highPriorityLabelIssues > 0
      ? `${summary.highPriorityLabelIssues} high-priority label issue${summary.highPriorityLabelIssues > 1 ? "s" : ""} in scope.`
      : "No high-priority labels flagged this window.",
    strongest
      ? `Top-ranked: ${strongest.key} with impact score ${strongest.impactScore}.`
      : "No ranked highlights available.",
    `${recentCount} issue${recentCount !== 1 ? "s" : ""} updated in the last 48 hours.`,
  ];

  const weeklyPointBullets = [
    [
      `Completed: ${summary.byBucket.completed}`,
      `Active: ${summary.byBucket.active}`,
      `Blocked: ${summary.byBucket.blocked}`,
    ],
    [
      `GitLab issues: ${summary.byProvider.gitlab}`,
      `Jira issues: ${summary.byProvider.jira}`,
      `GitHub issues: ${summary.byProvider.github}`,
    ],
    [
      `Contributed issues: ${summary.contribution.contributedIssues}`,
      `Authored by user: ${summary.contribution.authoredIssues}`,
      `Assigned to user: ${summary.contribution.assignedIssues}`,
      `Commented by user: ${summary.contribution.commentedIssues}`,
      `User comment count: ${summary.contribution.totalUserComments}`,
    ],
    [
      `High-priority label issues: ${summary.highPriorityLabelIssues}`,
      topLabel
        ? `Top recurring label: ${topLabel}`
        : "No recurring label trend this window.",
    ],
    strongest
      ? [
        `Top ranked issue: ${strongest.key}`,
        `Impact score: ${strongest.impactScore}`,
        `Bucket: ${strongest.bucket}`,
      ]
      : ["No ranked highlights were available."],
    [`Updates in last 48h scoring window: ${recentCount}`],
  ];

  const settings = PROFILE_SETTINGS[context.reportProfile];

  return {
    headlineLead,
    headlineFacts,
    topHighlightWording,
    collaborationHighlights,
    risksAndFollowUps,
    weeklyPointLeads: weeklyPointLeads.slice(0, settings.talkingPoints),
    weeklyPointBullets: weeklyPointBullets.slice(0, settings.talkingPoints),
  };
};

const buildNarrativeWithAi = async (
  summary: ReportSummary,
  context: ReportContext,
  coverage?: ReportCoverageSummary,
): Promise<NarrativeSections> => {
  const deterministic = buildDeterministicNarrative(summary, context, coverage);

  const aiRewrite = await applyAiNarrativeRewrite(
    {
      mode: context.aiNarrative,
      model: context.aiModel,
      apiKey: context.openaiApiKey,
      headlineLead: deterministic.headlineLead,
      topHighlightWording: deterministic.topHighlightWording,
      weeklyPointLeads: deterministic.weeklyPointLeads,
      context: {
        startDate: context.startDate,
        endDate: context.endDate,
        fetchMode: context.fetchMode,
        reportProfile: context.reportProfile,
      },
      payload: {
        highlights: summary.topActivityHighlights,
        collaboration: summary.collaborationHighlights,
        risks: summary.risksAndFollowUps,
      },
    },
  );

  const composeHeadline = (rewrite: AiNarrativeResult): string => {
    return `${rewrite.headlineLead} ${deterministic.headlineFacts}`.trim();
  };

  return {
    executiveHeadline: composeHeadline(aiRewrite),
    topHighlightWording: aiRewrite.topHighlightWording,
    collaborationHighlights: deterministic.collaborationHighlights,
    risksAndFollowUps: deterministic.risksAndFollowUps,
    weeklyTalkingPoints: aiRewrite.weeklyPointLeads.map((lead, index) => ({
      lead,
      bullets: deterministic.weeklyPointBullets[index] ?? [],
    })),
    aiAssisted: {
      executiveHeadline: aiRewrite.assisted.headline,
      topHighlights: aiRewrite.assisted.highlights,
      weeklyTalkingPoints: aiRewrite.assisted.weeklyTalkingPoints,
    },
  };
};

const renderTopHighlightLine = (
  issue: ReportIssueView,
  wording: string,
): string => {
  const labels = issue.labels.length
    ? ` | labels: ${issue.labels.join(", ")}`
    : "";
  const details = `[${
    formatProvider(issue.provider)
  }] ${issue.key} | ${issue.bucket} | impact ${issue.impactScore} | updated ${
    formatHumanDateTime(issue.updatedAt)
  }${labels}`;
  return `- ${details} :: ${wording}`;
};

const renderIssueLink = (issue: ReportIssueView): string => {
  return issue.url ? `[${issue.key}](${issue.url})` : issue.key;
};

const IMPACT_LEGEND_ITEMS = [
  "`80+`: high-impact activity with strong execution and ownership signals.",
  "`50-79`: meaningful progress with clear contribution momentum.",
  "`0-49`: lower impact or early-stage activity that still needs follow-through.",
  "Score inputs: completed +40, active +20, blocked +10, authored +15, assigned +10, user comments +2 each (max +10), high-impact labels +12, updated in final 48h +8.",
];


export const buildReportMarkdown = (
  summary: ReportSummary,
  narrative: NarrativeSections,
  context: ReportContext,
  normalizedIssues: NormalizedIssue[],
  coverage?: ReportCoverageSummary,
): string => {
  const lines: string[] = [
    "# Activity Report 2.0",
    "",
    "## Header / Context",
    `- Window: ${formatHumanDate(context.startDate)} -> ${
      formatHumanDate(context.endDate)
    }`,
    `- Fetch Mode: ${context.fetchMode}`,
    `- Report Profile: ${context.reportProfile}`,
    `- Report Format: ${context.reportFormat}`,
    `- Source Mode: ${context.sourceMode ?? "report"}`,
    "",
    `### Executive Headline${
      narrative.aiAssisted.executiveHeadline ? " (AI-assisted)" : ""
    }`,
    narrative.executiveHeadline,
    "",
    "## KPI Row",
    `- Total Issues: ${summary.totalIssues}`,
    `- Completed: ${summary.byBucket.completed}`,
    `- Active: ${summary.byBucket.active}`,
    `- Blocked: ${summary.byBucket.blocked}`,
    `- User Contributed Issues: ${summary.contribution.contributedIssues}`,
    `- User Comment Count: ${summary.contribution.totalUserComments}`,
    `- High-Priority Label Issues: ${summary.highPriorityLabelIssues}`,
    `- GitLab Issues: ${summary.byProvider.gitlab}`,
    `- Jira Issues: ${summary.byProvider.jira}`,
    `- GitHub Issues: ${summary.byProvider.github}`,
    "",
    "## Impact Legend",
    ...IMPACT_LEGEND_ITEMS.map((line) => `- ${line}`),
    "",
    `## Top Activity Highlights${
      narrative.aiAssisted.topHighlights ? " (AI-assisted)" : ""
    }`,
  ];

  if (!summary.topActivityHighlights.length) {
    lines.push("- (none)");
  } else {
    for (const [index, issue] of summary.topActivityHighlights.entries()) {
      lines.push(
        renderTopHighlightLine(
          issue,
          narrative.topHighlightWording[index] ?? "",
        ),
      );
    }
  }

  lines.push("", "## Collaboration Highlights");
  lines.push(
    `- Total collaborative issues: ${summary.contribution.contributedIssues}`,
  );

  lines.push("", "## Risks and Follow-ups");
  if (!narrative.risksAndFollowUps.length) {
    lines.push("- No immediate follow-up actions required.");
  } else {
    for (const [index, line] of narrative.risksAndFollowUps.entries()) {
      lines.push(`${index + 1}. ${line}`);
    }
  }

  lines.push(
    "",
    `## Weekly Activity Talking Points${
      narrative.aiAssisted.weeklyTalkingPoints ? " (AI-assisted)" : ""
    }`,
  );
  if (!narrative.weeklyTalkingPoints.length) {
    lines.push("- (none)");
  } else {
    for (const point of narrative.weeklyTalkingPoints) {
      lines.push(`- **${point.lead}**`);
      for (const bullet of point.bullets) {
        lines.push(`  - ${bullet}`);
      }
    }
  }

  lines.push(
    "",
    "## Appendix",
    "| Rank | Issue | Provider | State | Bucket | Impact | Updated | Authored | Assigned | Commented |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );

  if (!normalizedIssues.length) {
    lines.push("| - | - | - | - | - | - | - | - | - | - |");
  } else {
    for (const [index, issue] of normalizedIssues.entries()) {
      lines.push(
        `| ${index + 1} | ${renderIssueLink(issue)} | ${
          formatProvider(issue.provider)
        } | ${issue.state} | ${issue.bucket} | ${issue.impactScore} | ${
          formatHumanDateTime(issue.updatedAt)
        } | ${issue.isAuthoredByUser ? "yes" : "no"} | ${
          issue.isAssignedToUser ? "yes" : "no"
        } | ${issue.isCommentedByUser ? "yes" : "no"} |`,
      );
    }
  }

  if (coverage) {
    lines.push("", "## Coverage");
    lines.push(
      `- Providers connected: ${coverage.connectedProviderCount}/${coverage.totalProviderCount}`,
    );
    if (coverage.failedProviders.length) {
      lines.push(`- Provider failures: ${coverage.failedProviders.join(", ")}`);
    } else {
      lines.push("- Provider failures: none");
    }
  }

  lines.push("");
  return lines.join("\n");
};

const SHADCN_RENDERER_DIR = "reporting/shadcn-renderer";
const SHADCN_RENDERER_SOURCE = `${SHADCN_RENDERER_DIR}/src/entry-server.tsx`;
const SHADCN_RENDERER_ENTRY =
  `${SHADCN_RENDERER_DIR}/dist/server/entry-server.js`;
let shadcnRendererReady = false;

const canExecuteCommand = async (command: string): Promise<boolean> => {
  try {
    const queried = await Deno.permissions.query({
      name: "run",
      command,
    });
    if (queried.state === "granted") {
      return true;
    }
    if (queried.state === "prompt") {
      const requested = await Deno.permissions.request({
        name: "run",
        command,
      });
      return requested.state === "granted";
    }
    return false;
  } catch {
    return false;
  }
};

const pathExists = async (path: string): Promise<boolean> => {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
  }
};

const rendererBuildIsStale = async (): Promise<boolean> => {
  if (!(await pathExists(SHADCN_RENDERER_ENTRY))) {
    return true;
  }

  const [sourceStat, distStat] = await Promise.all([
    Deno.stat(SHADCN_RENDERER_SOURCE),
    Deno.stat(SHADCN_RENDERER_ENTRY),
  ]);

  const sourceMtime = sourceStat.mtime?.getTime() ?? 0;
  const distMtime = distStat.mtime?.getTime() ?? 0;
  return sourceMtime > distMtime;
};

const assertPathReadable = async (
  path: string,
  missingMessage: string,
  unreadableMessage: string,
): Promise<void> => {
  try {
    await Deno.stat(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(missingMessage);
    }
    if (
      error instanceof Deno.errors.PermissionDenied ||
      (error instanceof Error && error.name === "NotCapable")
    ) {
      throw new Error(unreadableMessage);
    }
    throw error;
  }
};

const runNpmInRenderer = async (
  args: string[],
  failureTitle: string,
): Promise<void> => {
  const commandArgs = ["--prefix", SHADCN_RENDERER_DIR, ...args];
  const { success, code, stderr } = await new Deno.Command("npm", {
    args: commandArgs,
    stdout: "piped",
    stderr: "piped",
  }).output();

  if (success) {
    return;
  }

  const details = new TextDecoder().decode(stderr).trim();
  throw new Error(
    [
      failureTitle,
      `Command: npm ${commandArgs.join(" ")}.`,
      `npm exit code: ${code}.`,
      details ? `Details: ${details}` : "",
    ].filter(Boolean).join(" "),
  );
};

const ensureShadcnPackageRendererReady = async (): Promise<void> => {
  await assertPathReadable(
    `${SHADCN_RENDERER_DIR}/package.json`,
    "Shadcn renderer workspace is missing. Expected reporting/shadcn-renderer/package.json.",
    "Shadcn renderer workspace is unreadable. Re-run with `--allow-read=reporting/shadcn-renderer` or `--allow-read`.",
  );
  if (!(await canExecuteCommand("npm"))) {
    throw new Error(
      "Shadcn renderer requires npm run permission. Re-run with `--allow-run=npm` or `-A`.",
    );
  }
  if (shadcnRendererReady) {
    return;
  }

  if (!(await pathExists(`${SHADCN_RENDERER_DIR}/node_modules`))) {
    await runNpmInRenderer(
      ["install", "--no-audit", "--no-fund"],
      "Failed to install shadcn renderer dependencies.",
    );
  }

  if (await rendererBuildIsStale()) {
    await runNpmInRenderer(
      ["run", "build"],
      "Failed to build Vite shadcn renderer.",
    );
  }

  shadcnRendererReady = true;
};

const buildShadcnPackageHtml = async (
  summary: ReportSummary,
  narrative: NarrativeSections,
  context: ReportContext,
  normalizedIssues: NormalizedIssue[],
  coverage: ReportCoverageSummary,
  providerDistribution: Array<{ provider: ProviderName; count: number }>,
): Promise<string> => {
  await ensureShadcnPackageRendererReady();
  const payload = {
    summary,
    narrative,
    context,
    normalizedIssues,
    coverage,
    providerDistribution,
  };

  const child = new Deno.Command("npm", {
    args: ["--prefix", SHADCN_RENDERER_DIR, "run", "--silent", "render"],
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  }).spawn();

  const writer = child.stdin.getWriter();
  await writer.write(new TextEncoder().encode(JSON.stringify(payload)));
  await writer.close();

  const { success, code, stdout, stderr } = await child.output();
  if (!success) {
    const details = new TextDecoder().decode(stderr).trim();
    throw new Error(
      [
        "Shadcn package HTML renderer failed.",
        "The CLI auto-installs/builds renderer assets in reporting/shadcn-renderer.",
        "If it still fails, run `npm --prefix reporting/shadcn-renderer install`.",
        `npm exit code: ${code}.`,
        details ? `Details: ${details}` : "",
      ].filter(Boolean).join(" "),
    );
  }

  const html = new TextDecoder().decode(stdout).trim();
  if (!html) {
    throw new Error("Shadcn package HTML renderer returned empty output.");
  }

  return html;
};

const resolveWindowEndMs = (
  normalizedIssues: NormalizedIssue[],
  contextEndDate: string,
): number | undefined => {
  const parsedContextEnd = parseTimestamp(contextEndDate);
  if (parsedContextEnd > 0) {
    return parsedContextEnd;
  }

  const byIssueDates = normalizedIssues
    .map((issue) => parseTimestamp(issue.updatedAt))
    .filter((value) => value > 0);

  if (!byIssueDates.length) {
    return undefined;
  }

  return Math.max(...byIssueDates);
};

const applyIssueScoring = (
  normalizedIssues: NormalizedIssue[],
  contextEndDate: string,
): NormalizedIssue[] => {
  const windowEndMs = resolveWindowEndMs(normalizedIssues, contextEndDate);

  return normalizedIssues.map((issue) => ({
    ...issue,
    impactScore: scoreIssue(issue, windowEndMs),
  }));
};

const buildCoverageSummary = (
  summary: ReportSummary,
  diagnostics?: ReportBuildOptions["diagnostics"],
): ReportCoverageSummary => {
  const sourceMode = diagnostics?.sourceMode ?? "report";
  const requestedProviders = diagnostics?.requestedProviders?.length
    ? diagnostics.requestedProviders
    : (["gitlab", "jira", "github"] as ProviderName[]);

  const runResults = diagnostics?.runResults ?? [];
  const successfulProviders = runResults
    .filter((result) => result.status === "success")
    .map((result) => result.provider);
  const failedProviders = runResults
    .filter((result) => result.status === "failed")
    .map((result) => result.provider);

  const connectedProviderCount =
    requestedProviders.filter((provider) =>
      summary.byProvider[provider] > 0 || successfulProviders.includes(provider)
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

const buildProviderDistribution = (
  byProvider: ReportSummary["byProvider"],
): Array<{ provider: ProviderName; count: number }> => {
  return (["gitlab", "jira", "github"] as ProviderName[]).map((provider) => ({
    provider,
    count: byProvider[provider],
  }));
};

export const buildRunReport = async (
  providerIssues: Partial<Record<ProviderName, unknown[]>>,
  context: ReportContext,
  options: ReportBuildOptions = {},
): Promise<RunReport> => {
  const generatedAt = context.generatedAt ?? new Date().toISOString();
  const usernames = context.usernames ?? {};
  const normalizedIssuesBase: NormalizedIssue[] = [];

  for (const provider of Object.keys(providerIssues) as ProviderName[]) {
    normalizedIssuesBase.push(
      ...normalizeProviderIssues(
        provider,
        providerIssues[provider] ?? [],
        usernames[provider],
      ),
    );
  }

  const normalizedIssues = applyIssueScoring(
    normalizedIssuesBase,
    context.endDate,
  )
    .sort(compareIssues);

  const summary = buildReportSummary(normalizedIssues, context.reportProfile);
  const coverage = buildCoverageSummary(summary, options.diagnostics);
  const providerDistribution = buildProviderDistribution(summary.byProvider);
  const narrative = await buildNarrativeWithAi(summary, context, coverage);
  const settings = PROFILE_SETTINGS[context.reportProfile];
  const appendixIssues = normalizedIssues.slice(0, settings.appendix);

  const markdown = buildReportMarkdown(
    summary,
    narrative,
    { ...context, generatedAt },
    appendixIssues,
    coverage,
  );
  const html = await buildShadcnPackageHtml(
    summary,
    narrative,
    { ...context, generatedAt },
    appendixIssues,
    coverage,
    providerDistribution,
  );

  return {
    normalizedIssues,
    summary,
    coverage,
    providerDistribution,
    markdown,
    html,
    reportFormat: context.reportFormat,
    narrative,
    context: { startDate: context.startDate, endDate: context.endDate },
  };
};

const formatFilenameDate = (isoDate: string): string => {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return "unknown";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};

const buildOutputFileBase = (report: RunReport): string => {
  const start = formatFilenameDate(report.context.startDate);
  const end = formatFilenameDate(report.context.endDate);

  const providers = report.providerDistribution
    .filter((p) => p.count > 0)
    .map((p) => p.provider)
    .sort()
    .join("-");

  return `${start}_to_${end}_${providers || "none"}`;
};

export const writeRunReport = async (
  report: RunReport,
): Promise<
  { markdownPath?: string; htmlPath?: string; normalizedPath: string }
> => {
  const outputDir = "output";
  await Deno.mkdir(outputDir, { recursive: true });

  const fileBase = buildOutputFileBase(report);
  const keepFiles = new Set<string>();

  const normalizedPath = `${outputDir}/${fileBase}-normalized.json`;
  const normalizedIssuesForJson = report.normalizedIssues.map(
    ({ descriptionSnippet: _descriptionSnippet, ...issue }) => issue,
  );
  await Deno.writeTextFile(
    normalizedPath,
    JSON.stringify(normalizedIssuesForJson, null, 2),
  );
  keepFiles.add(normalizedPath.slice(outputDir.length + 1));

  let markdownPath: string | undefined;
  if (report.reportFormat === "markdown" || report.reportFormat === "both") {
    markdownPath = `${outputDir}/${fileBase}-summary.md`;
    await Deno.writeTextFile(markdownPath, report.markdown);
    keepFiles.add(markdownPath.slice(outputDir.length + 1));
  }

  let htmlPath: string | undefined;
  if (report.reportFormat === "html" || report.reportFormat === "both") {
    htmlPath = `${outputDir}/${fileBase}-summary.html`;
    await Deno.writeTextFile(htmlPath, report.html);
    keepFiles.add(htmlPath.slice(outputDir.length + 1));
  }

  for await (const entry of Deno.readDir(outputDir)) {
    if (!entry.isFile) {
      await Deno.remove(`${outputDir}/${entry.name}`, { recursive: true });
      continue;
    }
    if (keepFiles.has(entry.name)) continue;
    await Deno.remove(`${outputDir}/${entry.name}`);
  }

  return { markdownPath, htmlPath, normalizedPath };
};

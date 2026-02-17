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
  comparison: ReportComparisonSummary;
  coverage: ReportCoverageSummary;
  providerDistribution: Array<{ provider: ProviderName; count: number }>;
  trendSeries: TrendPoint[];
  markdown: string;
  html: string;
  reportFormat: ReportFormat;
  narrative: NarrativeSections;
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

export interface ComparisonDelta {
  current: number;
  previous: number;
  delta: number;
}

export interface ReportComparisonSummary {
  available: boolean;
  completed: ComparisonDelta | null;
  active: ComparisonDelta | null;
  blocked: ComparisonDelta | null;
  comments: ComparisonDelta | null;
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

export interface TrendPoint {
  label: string;
  completed: number;
  active: number;
  blocked: number;
}

export interface ReportBuildOptions {
  previousProviderIssues?: Partial<Record<ProviderName, unknown[]>>;
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

const highlightNarrativeFallback = (issue: ReportIssueView): string => {
  if (issue.bucket === "completed") {
    return "Closed with high delivery confidence and clear ownership evidence.";
  }

  if (issue.bucket === "blocked") {
    return "Requires follow-up to unblock delivery risk and preserve timeline.";
  }

  if (issue.isCommentedByUser || issue.isAssignedToUser) {
    return "Shows direct collaboration and active execution touchpoints.";
  }

  return "Represents ongoing activity with measurable impact signals.";
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
  const providerCount = coverage
    ? coverage.connectedProviderCount
    : [
      summary.byProvider.gitlab,
      summary.byProvider.jira,
      summary.byProvider.github,
    ].filter((count) => count > 0).length;

  const headlineLead = context.reportProfile === "brief"
    ? "Focused activity snapshot for the selected reporting window."
    : context.reportProfile === "showcase"
    ? "Impact showcase emphasizing execution momentum and collaboration."
    : "Activity retro emphasizing completed work, active flow, and next risks.";

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
      const modes = [
        issue.isAuthoredByUser ? "authored" : null,
        issue.isAssignedToUser ? "assigned" : null,
        issue.isCommentedByUser
          ? `commented (${issue.userCommentCount})`
          : null,
      ].filter(Boolean).join(", ");

      return `[${formatProvider(issue.provider)}] ${issue.key}: ${
        modes || "contributed"
      }; score ${issue.impactScore}; state ${issue.state}.`;
    },
  );

  const risksAndFollowUps = summary.risksAndFollowUps.map((issue) => {
    return `[${formatProvider(issue.provider)} ${issue.key}] ${
      summarizeFollowUpAction(issue)
    }`;
  });

  const topLabel = summary.topLabels[0]?.label;
  const strongest = summary.topActivityHighlights[0];

  const weeklyPointLeads = [
    "Delivery balance this window.",
    "Cross-provider coverage.",
    "Direct contribution footprint.",
    "Urgency and impact signals.",
    "Most significant item.",
    "Freshness near window end.",
  ];

  const recentWindowCutoff = parseTimestamp(context.endDate) -
    (48 * 60 * 60 * 1000);
  const recentCount = summary.latestUpdated.filter((issue) => {
    const updatedAtMs = parseTimestamp(issue.updatedAt);
    return updatedAtMs > 0 && updatedAtMs >= recentWindowCutoff;
  }).length;

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

const tooltipAttributes = (detail: string): string => {
  const safe = escapeHtml(detail);
  return `title="${safe}" data-tip="${safe}"`;
};

const capitalizeBucket = (value: ActivityBucket): string =>
  `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

const bucketToneClass = (value: ActivityBucket): string => {
  if (value === "completed") return "tone-completed";
  if (value === "blocked") return "tone-blocked";
  if (value === "active") return "tone-active";
  return "tone-other";
};

const parseRiskLine = (value: string): { context: string; action: string } => {
  const match = value.match(/^\[([^\]]+)\]\s*(.+)$/);
  if (!match) {
    return {
      context: "Follow-up",
      action: value,
    };
  }
  return {
    context: match[1],
    action: match[2],
  };
};

export const buildReportMarkdown = (
  summary: ReportSummary,
  narrative: NarrativeSections,
  context: ReportContext,
  normalizedIssues: NormalizedIssue[],
  comparison?: ReportComparisonSummary,
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

  lines.push("", "## Comparison");
  if (!comparison?.available || !comparison.completed || !comparison.active ||
    !comparison.blocked || !comparison.comments) {
    lines.push("- Week-over-week deltas unavailable (missing previous window data).");
  } else {
    lines.push(`- Completed: ${comparison.completed.current} (${comparison.completed.delta >= 0 ? "+" : ""}${comparison.completed.delta})`);
    lines.push(`- Active: ${comparison.active.current} (${comparison.active.delta >= 0 ? "+" : ""}${comparison.active.delta})`);
    lines.push(`- Blocked: ${comparison.blocked.current} (${comparison.blocked.delta >= 0 ? "+" : ""}${comparison.blocked.delta})`);
    lines.push(`- Comments: ${comparison.comments.current} (${comparison.comments.delta >= 0 ? "+" : ""}${comparison.comments.delta})`);
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

const escapeHtml = (value: string): string => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
};

const renderHtmlIssueCard = (
  issue: ReportIssueView,
  wording: string,
): string => {
  const labels = issue.labels.length
    ? issue.labels.map((label) =>
      `<span class="ui-badge ui-badge-subtle" ${
        tooltipAttributes(
          `Label ${label}. High-impact labels contribute +12 to impact score.`,
        )
      }>#${escapeHtml(label)}</span>`
    ).join("")
    : "";

  const attributionModes = [
    issue.isAuthoredByUser ? "authored" : null,
    issue.isAssignedToUser ? "assigned" : null,
    issue.isCommentedByUser ? `commented (${issue.userCommentCount})` : null,
  ].filter(Boolean).join(", ");

  const issueTitle = issue.url
    ? `<a class="issue-link" href="${escapeHtml(issue.url)}" ${
      tooltipAttributes("Open issue in provider.")
    }>${escapeHtml(issue.key)}</a>`
    : `<span class="issue-link" ${
      tooltipAttributes("Issue key in provider.")
    }>${escapeHtml(issue.key)}</span>`;

  const detailsTip = `${
    formatProvider(issue.provider)
  } ${issue.key}. Bucket ${issue.bucket}. Impact ${issue.impactScore}. Updated ${
    formatHumanDateTime(issue.updatedAt)
  }. ${
    attributionModes || "No direct attribution match for configured usernames."
  }`;

  const attributionPill = attributionModes
    ? `<span class="ui-badge ui-badge-primary" ${
      tooltipAttributes("How the configured user contributed to this issue.")
    }>${escapeHtml(attributionModes)}</span>`
    : `<span class="ui-badge ui-badge-muted" ${
      tooltipAttributes("No direct attribution match for configured usernames.")
    }>no direct attribution</span>`;

  return `
    <article class="issue-card ${bucketToneClass(issue.bucket)}" ${
    tooltipAttributes(detailsTip)
  }>
      <header class="issue-card-head">
        <p class="issue-kicker">${
    escapeHtml(formatProvider(issue.provider))
  }</p>
        <div class="impact-chip" ${
    tooltipAttributes(
      "Deterministic impact score from state, attribution, comments, labels, and recency.",
    )
  }><span>Impact</span><strong>${issue.impactScore}</strong></div>
      </header>
      <h3 class="issue-title">${issueTitle} <span class="issue-title-copy">${
    escapeHtml(issue.title)
  }</span></h3>
      <p class="issue-meta">${escapeHtml(issue.bucket)} • ${
    escapeHtml(issue.state)
  } • Updated ${escapeHtml(formatHumanDateTime(issue.updatedAt))}</p>
      <p class="issue-wording" ${
    tooltipAttributes(
      "Deterministic/AI-rewritten wording for this highlight only.",
    )
  }>${escapeHtml(wording)}</p>
      <div class="issue-pill-row">
        <span class="ui-badge ui-badge-bucket ${
    bucketToneClass(issue.bucket)
  }" ${tooltipAttributes("State bucket used in scoring.")}>${
    escapeHtml(capitalizeBucket(issue.bucket))
  }</span>
        ${attributionPill}
      </div>
      ${labels ? `<div class="issue-label-row">${labels}</div>` : ""}
    </article>
  `;
};

export const buildReportHtml = (
  summary: ReportSummary,
  narrative: NarrativeSections,
  context: ReportContext,
  normalizedIssues: NormalizedIssue[],
): string => {
  const kpiItems: Array<{ label: string; value: string; detail: string }> = [
    {
      label: "Total Issues",
      value: String(summary.totalIssues),
      detail: "Total normalized issues in this report window.",
    },
    {
      label: "Completed",
      value: String(summary.byBucket.completed),
      detail: "Issues bucketed as completed (+40 base score each).",
    },
    {
      label: "Active",
      value: String(summary.byBucket.active),
      detail: "Issues bucketed as active (+20 base score each).",
    },
    {
      label: "Blocked",
      value: String(summary.byBucket.blocked),
      detail: "Issues bucketed as blocked (+10 base score each).",
    },
    {
      label: "Contributed Issues",
      value: String(summary.contribution.contributedIssues),
      detail:
        "Issues where configured user is author, assignee, or comment author.",
    },
    {
      label: "User Comments",
      value: String(summary.contribution.totalUserComments),
      detail: "Total matching comments by configured user across all issues.",
    },
    {
      label: "High-Priority Label Issues",
      value: String(summary.highPriorityLabelIssues),
      detail:
        "Issues containing priority/risk labels (p0, p1, sev, incident, security, customer, prod, revenue).",
    },
    {
      label: "GitLab Issues",
      value: String(summary.byProvider.gitlab),
      detail: "Number of GitLab issues included.",
    },
    {
      label: "Jira Issues",
      value: String(summary.byProvider.jira),
      detail: "Number of Jira issues included.",
    },
    {
      label: "GitHub Issues",
      value: String(summary.byProvider.github),
      detail: "Number of GitHub issues included.",
    },
  ];

  const topCards = summary.topActivityHighlights.length
    ? summary.topActivityHighlights
      .map((issue, index) =>
        renderHtmlIssueCard(issue, narrative.topHighlightWording[index] ?? "")
      )
      .join("\n")
    : '<p class="empty-state" title="No issues qualified for top highlight selection." data-tip="No issues qualified for top highlight selection.">No highlights selected.</p>';

  const riskItems = narrative.risksAndFollowUps.length
    ? narrative.risksAndFollowUps
      .map((line, index) => {
        const parsed = parseRiskLine(line);
        return `<li class="risk-card" ${
          tooltipAttributes(
            `Follow-up ${
              index + 1
            }. Context: ${parsed.context}. Action: ${parsed.action}`,
          )
        }><span class="risk-index">${
          index + 1
        }</span><div class="risk-copy"><p class="risk-context">${
          escapeHtml(parsed.context)
        }</p><p class="risk-action">${
          escapeHtml(parsed.action)
        }</p></div></li>`;
      })
      .join("")
    : '<li class="empty-state" title="No follow-up actions are currently required." data-tip="No follow-up actions are currently required."><p>No immediate follow-up actions required.</p></li>';

  const talkingItems = narrative.weeklyTalkingPoints.length
    ? narrative.weeklyTalkingPoints
      .map((point) => {
        const bullets = point.bullets.length
          ? point.bullets.map((bullet) =>
            `<li ${tooltipAttributes(`Talking-point detail: ${bullet}`)}>${
              escapeHtml(bullet)
            }</li>`
          ).join("")
          : '<li class="empty" title="No additional detail was generated." data-tip="No additional detail was generated.">No additional detail.</li>';
        return `<article class="talk-card ui-card" ${
          tooltipAttributes(`Talking point: ${point.lead}`)
        }><h4>${escapeHtml(point.lead)}</h4><ul>${bullets}</ul></article>`;
      })
      .join("")
    : '<p class="empty-state" title="No talking points were generated." data-tip="No talking points were generated.">No talking points generated.</p>';

  const collaborationBullets = narrative.collaborationHighlights.length
    ? narrative.collaborationHighlights
      .map((line) =>
        `<li class="collab-item" ${
          tooltipAttributes(`Collaboration detail: ${line}`)
        }>${escapeHtml(line)}</li>`
      )
      .join("")
    : '<li class="empty" title="No additional collaboration narrative available." data-tip="No additional collaboration narrative available.">No additional collaboration narrative available.</li>';

  const appendixRows = normalizedIssues.length
    ? normalizedIssues
      .map((issue, index) => {
        const keyCell = issue.url
          ? `<a href="${escapeHtml(issue.url)}" ${
            tooltipAttributes("Open issue in provider.")
          }>${escapeHtml(issue.key)}</a>`
          : `<span ${tooltipAttributes("Issue key in provider.")}>${
            escapeHtml(issue.key)
          }</span>`;

        const rowTip = `${
          formatProvider(issue.provider)
        } ${issue.key}. State ${issue.state}. Bucket ${issue.bucket}. Impact ${issue.impactScore}. Updated ${
          formatHumanDateTime(issue.updatedAt)
        }.`;

        return `<tr ${tooltipAttributes(rowTip)}>
          <td class="mono">${index + 1}</td>
          <td class="issue-cell">${keyCell}</td>
          <td>${escapeHtml(formatProvider(issue.provider))}</td>
          <td>${escapeHtml(issue.state)}</td>
          <td><span class="ui-badge ui-badge-bucket inline-bucket ${
          bucketToneClass(issue.bucket)
        }">${escapeHtml(issue.bucket)}</span></td>
          <td class="mono">${issue.impactScore}</td>
          <td>${escapeHtml(formatHumanDateTime(issue.updatedAt))}</td>
          <td class="mono">${issue.isAuthoredByUser ? "yes" : "no"}</td>
          <td class="mono">${issue.isAssignedToUser ? "yes" : "no"}</td>
          <td class="mono">${issue.isCommentedByUser ? "yes" : "no"}</td>
        </tr>`;
      })
      .join("\n")
    : '<tr><td colspan="10" class="empty-row">No issues available.</td></tr>';

  const generatedAt = formatHumanDateTime(new Date().toISOString());
  const windowLabel = `${formatHumanDate(context.startDate)} -> ${
    formatHumanDate(context.endDate)
  }`;
  const impactLegend = IMPACT_LEGEND_ITEMS
    .map((line) =>
      `<li ${tooltipAttributes(`Impact scoring detail: ${line}`)}>${
        escapeHtml(line)
      }</li>`
    )
    .join("");

  const providerBreakdown = [
    { name: "GitLab", value: summary.byProvider.gitlab },
    { name: "Jira", value: summary.byProvider.jira },
    { name: "GitHub", value: summary.byProvider.github },
  ];

  const providerTotal = providerBreakdown.reduce(
    (total, provider) => total + provider.value,
    0,
  );

  const providerCards = providerBreakdown.map((provider) => {
    const percentage = providerTotal
      ? Math.round((provider.value / providerTotal) * 100)
      : 0;
    return `<article class="provider-card ui-card" ${
      tooltipAttributes(`${provider.name} issue count: ${provider.value}.`)
    }>
      <p class="provider-name">${provider.name}</p>
      <strong class="mono">${provider.value}</strong>
      <div class="provider-track" aria-hidden="true"><span style="width: ${percentage}%"></span></div>
    </article>`;
  }).join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Activity Report (ShadCN)</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        theme: {
          extend: {
            fontFamily: {
              sans: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
              mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
            },
          },
        },
      };
    </script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
      :root {
        --background: 30 33% 98%;
        --foreground: 224 71% 4%;
        --muted: 220 16% 47%;
        --muted-foreground: 220 10% 38%;
        --card: 0 0% 100%;
        --card-foreground: 224 71% 4%;
        --border: 220 13% 91%;
        --input: 220 13% 91%;
        --primary: 217 91% 60%;
        --primary-foreground: 210 40% 98%;
        --secondary: 210 40% 96%;
        --secondary-foreground: 222 47% 11%;
        --accent: 27 96% 61%;
        --accent-foreground: 20 14% 4%;
        --radius: 0.75rem;
        --shadow-soft: 0 10px 35px rgba(15, 23, 42, 0.08);
        --shadow-card: 0 4px 18px rgba(15, 23, 42, 0.07);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        color: hsl(var(--foreground));
        font-family: "Manrope", "Avenir Next", "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at 0% 0%, rgba(59, 130, 246, 0.18), transparent 28%),
          radial-gradient(circle at 95% 5%, rgba(249, 115, 22, 0.17), transparent 30%),
          radial-gradient(circle at 65% 110%, rgba(14, 165, 233, 0.15), transparent 38%),
          hsl(var(--background));
      }
      body::before {
        content: "";
        position: fixed;
        inset: -20vh -20vw;
        background:
          linear-gradient(110deg, rgba(59, 130, 246, 0.07), transparent 45%),
          linear-gradient(310deg, rgba(249, 115, 22, 0.08), transparent 55%);
        pointer-events: none;
        filter: blur(20px);
      }
      .shell {
        max-width: 1220px;
        margin: 0 auto;
        padding: clamp(1rem, 2.2vw, 1.8rem);
        position: relative;
        z-index: 1;
      }
      .ui-card {
        border: 1px solid hsl(var(--border));
        background: hsl(var(--card));
        border-radius: var(--radius);
        box-shadow: var(--shadow-card);
      }
      .section-card {
        border: 1px solid hsl(var(--border));
        background: linear-gradient(145deg, rgba(255, 255, 255, 0.94), rgba(255, 251, 245, 0.86));
        border-radius: calc(var(--radius) + 0.2rem);
        padding: clamp(0.9rem, 1.7vw, 1.25rem);
        box-shadow: var(--shadow-soft);
        margin-bottom: 0.95rem;
        position: relative;
        overflow: hidden;
      }
      .hero-card {
        display: grid;
        gap: 1rem;
      }
      .hero-card::after {
        content: "";
        position: absolute;
        width: 280px;
        height: 280px;
        border-radius: 999px;
        background: radial-gradient(circle, rgba(59, 130, 246, 0.15), transparent 68%);
        right: -110px;
        top: -120px;
        pointer-events: none;
      }
      .hero-grid {
        display: grid;
        gap: 0.9rem;
      }
      .hero-eyebrow {
        margin: 0;
        font-size: 0.76rem;
        text-transform: uppercase;
        letter-spacing: 0.15em;
        color: hsl(var(--primary));
        font-weight: 800;
      }
      .hero-title {
        margin: 0.12rem 0 0;
        font-size: clamp(2rem, 5.8vw, 3.3rem);
        line-height: 1;
        letter-spacing: -0.03em;
      }
      .hero-meta {
        margin: 0.66rem 0 0;
        color: hsl(var(--muted-foreground));
        font-size: 0.93rem;
      }
      .headline {
        margin: 0.62rem 0 0;
        font-size: clamp(1rem, 2.25vw, 1.22rem);
        line-height: 1.47;
        max-width: 64ch;
      }
      .hero-stat-grid {
        display: grid;
        gap: 0.6rem;
      }
      .hero-stat {
        border: 1px solid hsl(var(--border));
        background: hsl(var(--card));
        border-radius: calc(var(--radius) - 0.12rem);
        padding: 0.6rem 0.72rem;
        box-shadow: var(--shadow-card);
      }
      .hero-stat p {
        margin: 0;
        font-size: 0.76rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: hsl(var(--muted-foreground));
      }
      .hero-stat strong {
        font-size: 1.68rem;
        line-height: 1;
        display: block;
        margin-top: 0.28rem;
      }
      .provider-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 0.58rem;
      }
      .provider-card {
        padding: 0.56rem 0.62rem;
      }
      .provider-name {
        margin: 0;
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: hsl(var(--muted-foreground));
      }
      .provider-card strong {
        display: inline-block;
        margin: 0.2rem 0 0.36rem;
        font-size: 1rem;
      }
      .provider-track {
        width: 100%;
        height: 0.36rem;
        border-radius: 999px;
        background: hsl(var(--secondary));
        overflow: hidden;
      }
      .provider-track span {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)));
      }
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 0.62rem;
      }
      .kpi-card {
        padding: 0.72rem;
      }
      .kpi-card p {
        margin: 0;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: hsl(var(--muted-foreground));
      }
      .kpi-card strong {
        display: block;
        margin-top: 0.22rem;
        font-size: 1.28rem;
        line-height: 1.12;
      }
      .section-title {
        margin: 0 0 0.68rem;
        font-size: clamp(1.05rem, 2.2vw, 1.32rem);
        letter-spacing: -0.015em;
      }
      .legend-list {
        margin: 0;
        padding-left: 1.15rem;
        color: hsl(var(--muted-foreground));
        columns: 2 280px;
        gap: 1.4rem;
      }
      .legend-list li {
        margin: 0.36rem 0;
        break-inside: avoid;
      }
      .badge {
        display: inline-block;
        font-size: 0.71rem;
        color: hsl(var(--primary-foreground));
        background: hsl(var(--primary));
        border: 1px solid hsl(var(--primary));
        border-radius: 999px;
        padding: 0.12rem 0.46rem;
        margin-left: 0.38rem;
        vertical-align: middle;
        font-family: "JetBrains Mono", monospace;
      }
      .highlight-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 0.72rem;
      }
      .issue-card {
        border: 1px solid hsl(var(--border));
        border-left-width: 5px;
        border-radius: calc(var(--radius) - 0.05rem);
        background: hsl(var(--card));
        padding: 0.78rem;
        box-shadow: var(--shadow-card);
      }
      .issue-card.tone-completed { border-left-color: #059669; }
      .issue-card.tone-active { border-left-color: #2563eb; }
      .issue-card.tone-blocked { border-left-color: #ea580c; }
      .issue-card.tone-other { border-left-color: #64748b; }
      .issue-card-head {
        display: flex;
        justify-content: space-between;
        align-items: start;
        gap: 0.72rem;
      }
      .issue-kicker {
        margin: 0;
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: hsl(var(--muted-foreground));
        font-family: "JetBrains Mono", monospace;
      }
      .issue-title {
        margin: 0.36rem 0 0;
        font-size: 1rem;
        line-height: 1.3;
      }
      .issue-link {
        color: hsl(var(--primary));
        text-decoration: none;
        font-weight: 700;
      }
      .issue-link:hover { text-decoration: underline; }
      .issue-title-copy {
        color: hsl(var(--foreground));
        font-weight: 500;
      }
      .impact-chip {
        font-family: "JetBrains Mono", monospace;
        font-size: 0.68rem;
        display: inline-flex;
        gap: 0.33rem;
        align-items: baseline;
        background: rgba(37, 99, 235, 0.1);
        color: #1d4ed8;
        border: 1px solid rgba(37, 99, 235, 0.26);
        border-radius: 999px;
        padding: 0.16rem 0.48rem;
        white-space: nowrap;
      }
      .impact-chip strong {
        font-size: 0.85rem;
        line-height: 1;
      }
      .issue-meta {
        margin: 0.4rem 0 0;
        font-size: 0.8rem;
        color: hsl(var(--muted-foreground));
      }
      .issue-wording {
        margin: 0.5rem 0 0;
        line-height: 1.46;
      }
      .issue-pill-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        margin-top: 0.62rem;
      }
      .ui-badge {
        font-family: "JetBrains Mono", monospace;
        font-size: 0.68rem;
        border-radius: 999px;
        padding: 0.12rem 0.46rem;
        border: 1px solid transparent;
      }
      .ui-badge-primary {
        background: rgba(37, 99, 235, 0.12);
        color: #1d4ed8;
        border-color: rgba(37, 99, 235, 0.26);
      }
      .ui-badge-muted {
        background: hsl(var(--secondary));
        color: hsl(var(--muted-foreground));
        border-color: hsl(var(--border));
      }
      .ui-badge-subtle {
        background: rgba(249, 115, 22, 0.08);
        color: #9a3412;
        border-color: rgba(249, 115, 22, 0.25);
      }
      .ui-badge-bucket.tone-completed {
        background: rgba(5, 150, 105, 0.12);
        color: #047857;
        border-color: rgba(5, 150, 105, 0.25);
      }
      .ui-badge-bucket.tone-active {
        background: rgba(29, 78, 216, 0.12);
        color: #1d4ed8;
        border-color: rgba(29, 78, 216, 0.24);
      }
      .ui-badge-bucket.tone-blocked {
        background: rgba(234, 88, 12, 0.13);
        color: #c2410c;
        border-color: rgba(234, 88, 12, 0.24);
      }
      .ui-badge-bucket.tone-other {
        background: rgba(100, 116, 139, 0.12);
        color: #475569;
        border-color: rgba(100, 116, 139, 0.24);
      }
      .issue-label-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.34rem;
        margin-top: 0.52rem;
      }
      .collab-layout {
        display: grid;
        gap: 0.72rem;
      }
      .collab-count {
        border: 1px solid hsl(var(--border));
        background: linear-gradient(140deg, rgba(37, 99, 235, 0.09), rgba(249, 115, 22, 0.08));
        border-radius: calc(var(--radius) + 0.02rem);
        padding: 0.78rem;
      }
      .collab-count p {
        margin: 0;
        color: hsl(var(--muted-foreground));
        font-size: 0.82rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .collab-count strong {
        display: block;
        margin-top: 0.25rem;
        font-size: clamp(2rem, 5.2vw, 2.95rem);
        line-height: 1;
      }
      .collab-list {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .collab-item {
        border: 1px solid hsl(var(--border));
        border-radius: calc(var(--radius) - 0.12rem);
        padding: 0.62rem 0.68rem;
        margin-bottom: 0.45rem;
        background: hsl(var(--card));
        color: hsl(var(--muted-foreground));
      }
      .followup-list {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 0.62rem;
      }
      .risk-card {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 0.64rem;
        align-items: start;
        border-radius: calc(var(--radius) - 0.05rem);
        border: 1px solid hsl(var(--border));
        background: hsl(var(--card));
        padding: 0.74rem;
      }
      .risk-index {
        display: inline-flex;
        justify-content: center;
        align-items: center;
        width: 1.5rem;
        height: 1.5rem;
        border-radius: 999px;
        background: rgba(249, 115, 22, 0.18);
        color: #9a3412;
        font-family: "JetBrains Mono", monospace;
        font-size: 0.74rem;
      }
      .risk-copy p { margin: 0; }
      .risk-context {
        font-family: "JetBrains Mono", monospace;
        font-size: 0.72rem;
        color: hsl(var(--muted-foreground));
        margin-bottom: 0.18rem;
      }
      .risk-action {
        line-height: 1.45;
        font-weight: 500;
      }
      .talk-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 0.72rem;
      }
      .talk-card {
        padding: 0.72rem;
      }
      .talk-card h4 {
        margin: 0;
        font-size: 0.98rem;
      }
      .talk-card ul {
        margin: 0.5rem 0 0;
        padding-left: 1rem;
        color: hsl(var(--muted-foreground));
      }
      .talk-card li { margin: 0.29rem 0; }
      .empty-state {
        border: 1px dashed hsl(var(--border));
        border-radius: calc(var(--radius) - 0.08rem);
        background: rgba(255, 255, 255, 0.78);
        margin: 0;
        padding: 0.72rem;
        color: hsl(var(--muted-foreground));
        font-style: italic;
      }
      .empty {
        color: hsl(var(--muted-foreground));
        font-style: italic;
      }
      .table-wrap {
        overflow-x: auto;
        border: 1px solid hsl(var(--border));
        border-radius: calc(var(--radius) + 0.02rem);
        background: rgba(255, 255, 255, 0.92);
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
      }
      th, td {
        border-bottom: 1px solid rgba(23, 20, 42, 0.09);
        text-align: left;
        padding: 0.52rem 0.56rem;
        vertical-align: top;
      }
      th {
        background: hsl(var(--secondary));
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: hsl(var(--muted-foreground));
      }
      .mono {
        font-family: "JetBrains Mono", monospace;
        font-size: 0.78rem;
      }
      .issue-cell a {
        color: hsl(var(--primary));
        font-weight: 700;
        text-decoration: none;
      }
      .issue-cell a:hover { text-decoration: underline; }
      .inline-bucket { font-size: 0.65rem; }
      .empty-row {
        text-align: center;
        color: hsl(var(--muted-foreground));
        padding: 0.82rem;
      }
      .generated {
        margin-top: 0.64rem;
        color: hsl(var(--muted-foreground));
        font-size: 0.76rem;
        font-family: "JetBrains Mono", monospace;
      }
      [data-tip] { position: relative; cursor: help; }
      @media (hover: hover) and (pointer: fine) {
        [data-tip]:hover::after, [data-tip]:focus-visible::after {
          content: attr(data-tip);
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          bottom: calc(100% + 10px);
          width: max-content;
          max-width: min(340px, 78vw);
          padding: 0.5rem 0.6rem;
          border-radius: 0.58rem;
          border: 1px solid rgba(30, 64, 175, 0.25);
          background: rgba(23, 20, 42, 0.95);
          color: #fff;
          font-size: 0.72rem;
          line-height: 1.35;
          z-index: 120;
          white-space: normal;
          box-shadow: 0 14px 28px rgba(15, 23, 42, 0.34);
          pointer-events: none;
        }
        [data-tip]:hover::before, [data-tip]:focus-visible::before {
          content: "";
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          bottom: calc(100% + 5px);
          border-width: 6px;
          border-style: solid;
          border-color: rgba(23, 20, 42, 0.95) transparent transparent transparent;
          z-index: 120;
          pointer-events: none;
        }
      }
      @media (min-width: 930px) {
        .hero-grid { grid-template-columns: 1.25fr 0.75fr; align-items: end; }
        .collab-layout { grid-template-columns: minmax(240px, 320px) 1fr; align-items: start; }
      }
      @media (max-width: 760px) {
        .shell { padding: 0.88rem; }
        .section-card { border-radius: 1rem; }
        .hero-title { font-size: clamp(1.72rem, 11vw, 2.2rem); }
        .risk-card { grid-template-columns: 1fr; }
        .risk-index { width: 1.35rem; height: 1.35rem; }
        .legend-list { columns: 1; }
      }
      @media print {
        body { background: #fff; }
        body::before { display: none; }
        .section-card, .issue-card, .talk-card, .kpi-card, .provider-card, .table-wrap, .risk-card, .collab-item {
          border-color: #d1d5db;
          box-shadow: none;
          background: #fff;
          backdrop-filter: none;
        }
        [data-tip]::before, [data-tip]::after { display: none !important; }
        a { color: #000; text-decoration: none; }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="section-card hero-card">
        <div class="hero-grid">
          <div>
            <h1 class="hero-title" ${
    tooltipAttributes(
      "Deterministic activity report with optional AI wording enhancement for select narrative sections.",
    )
  }>
              <span class="hero-eyebrow">ShadCN Report Surface</span><br />
              Engineering Activity Report
            </h1>
            <p class="hero-meta">Window: ${
    escapeHtml(windowLabel)
  } | Fetch Mode: ${escapeHtml(context.fetchMode)} | Profile: ${
    escapeHtml(context.reportProfile)
  }</p>
            <p class="hero-meta" ${
    tooltipAttributes(
      "Top-line summary synthesized from deterministic metrics.",
    )
  }>Executive Headline${
    narrative.aiAssisted.executiveHeadline
      ? ' <span class="badge">AI-assisted</span>'
      : ""
  }</p>
            <p class="headline">${escapeHtml(narrative.executiveHeadline)}</p>
          </div>
          <aside class="hero-stat-grid">
            <article class="hero-stat" ${
    tooltipAttributes("Total normalized issues in this report window.")
  }>
              <p>Total Issues</p>
              <strong class="mono">${summary.totalIssues}</strong>
            </article>
            <article class="hero-stat" ${
    tooltipAttributes(
      "Issues where configured user is author, assignee, or comment author.",
    )
  }>
              <p>Contributed Issues</p>
              <strong class="mono">${summary.contribution.contributedIssues}</strong>
            </article>
            <article class="hero-stat" ${
    tooltipAttributes(
      "Total matching comments by configured user across all issues.",
    )
  }>
              <p>User Comments</p>
              <strong class="mono">${summary.contribution.totalUserComments}</strong>
            </article>
          </aside>
        </div>
        <div class="provider-grid">${providerCards}</div>
        <p class="generated">Generated: ${escapeHtml(generatedAt)}</p>
      </section>

      <section class="section-card">
        <h2 class="section-title" ${
    tooltipAttributes("Primary KPIs for this report window.")
  }>KPI Row</h2>
        <div class="kpi-grid">
          ${
    kpiItems.map((item) =>
      `<article class="kpi-card ui-card" ${tooltipAttributes(item.detail)}><p>${
        escapeHtml(item.label)
      }</p><strong class="mono">${escapeHtml(item.value)}</strong></article>`
    ).join("")
  }
        </div>
      </section>

      <section class="section-card">
        <h2 class="section-title" ${
    tooltipAttributes(
      "How to interpret impact score values shown across highlights and appendix.",
    )
  }>Impact Legend</h2>
        <ul class="legend-list">${impactLegend}</ul>
      </section>

      <section class="section-card">
        <h2 class="section-title" ${
    tooltipAttributes(
      "Top ranked issues by deterministic impact score, then recency, then key.",
    )
  }>Top Activity Highlights${
    narrative.aiAssisted.topHighlights
      ? ' <span class="badge">AI-assisted</span>'
      : ""
  }</h2>
        <div class="highlight-grid">${topCards}</div>
      </section>

      <section class="section-card">
        <h2 class="section-title" ${
    tooltipAttributes(
      "Total issues where configured user was author, assignee, or comment contributor.",
    )
  }>Collaboration Highlights</h2>
        <div class="collab-layout">
          <article class="collab-count ui-card">
            <p>Total collaborative issues</p>
            <strong class="mono" ${
    tooltipAttributes(
      "Collaboration total for this report window.",
    )
  }>${summary.contribution.contributedIssues}</strong>
          </article>
          <ul class="collab-list">${collaborationBullets}</ul>
        </div>
      </section>

      <section class="section-card">
        <h2 class="section-title" ${
    tooltipAttributes(
      "Action-focused follow-ups selected from blocked/high-risk/high-impact active work.",
    )
  }>Risks and Follow-ups</h2>
        <ul class="followup-list">${riskItems}</ul>
      </section>

      <section class="section-card">
        <h2 class="section-title" ${
    tooltipAttributes(
      "Structured talking points for weekly updates with concise, vertical bullet detail.",
    )
  }>Weekly Activity Talking Points${
    narrative.aiAssisted.weeklyTalkingPoints
      ? ' <span class="badge">AI-assisted</span>'
      : ""
  }</h2>
        <div class="talk-grid">${talkingItems}</div>
      </section>

      <section class="section-card">
        <h2 class="section-title" ${
    tooltipAttributes(
      "Ranked issue appendix with deterministic attribution fields.",
    )
  }>Appendix</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th ${
    tooltipAttributes("Deterministic rank in final ordered list.")
  }>Rank</th>
                <th ${
    tooltipAttributes("Provider issue key with optional link.")
  }>Issue</th>
                <th ${tooltipAttributes("Source provider.")}>Provider</th>
                <th ${tooltipAttributes("Raw provider state.")}>State</th>
                <th ${
    tooltipAttributes("Normalized activity bucket.")
  }>Bucket</th>
                <th ${
    tooltipAttributes("Deterministic impact score.")
  }>Impact</th>
                <th ${
    tooltipAttributes("Most recent provider update time (UTC).")
  }>Updated</th>
                <th ${
    tooltipAttributes("Was issue authored by configured user?")
  }>Authored</th>
                <th ${
    tooltipAttributes("Was issue assigned to configured user?")
  }>Assigned</th>
                <th ${
    tooltipAttributes("Did configured user comment on the issue?")
  }>Commented</th>
              </tr>
            </thead>
            <tbody>
              ${appendixRows}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </body>
</html>`;
};

const SHADCN_RENDERER_DIR = "reporting/shadcn-renderer";
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

  if (!(await pathExists(SHADCN_RENDERER_ENTRY))) {
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
  comparison: ReportComparisonSummary,
  coverage: ReportCoverageSummary,
  providerDistribution: Array<{ provider: ProviderName; count: number }>,
  trendSeries: TrendPoint[],
): Promise<string> => {
  await ensureShadcnPackageRendererReady();
  const payload = {
    summary,
    narrative,
    context,
    normalizedIssues,
    comparison,
    coverage,
    providerDistribution,
    trendSeries,
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

const buildComparisonDelta = (
  current: number,
  previous: number,
): ComparisonDelta => ({
  current,
  previous,
  delta: current - previous,
});

const buildComparisonSummary = (
  currentIssues: NormalizedIssue[],
  previousIssues?: NormalizedIssue[],
): ReportComparisonSummary => {
  if (!previousIssues || previousIssues.length === 0) {
    return {
      available: false,
      completed: null,
      active: null,
      blocked: null,
      comments: null,
    };
  }

  const currentSummary = buildReportSummary(currentIssues);
  const previousSummary = buildReportSummary(previousIssues);

  return {
    available: true,
    completed: buildComparisonDelta(
      currentSummary.byBucket.completed,
      previousSummary.byBucket.completed,
    ),
    active: buildComparisonDelta(
      currentSummary.byBucket.active,
      previousSummary.byBucket.active,
    ),
    blocked: buildComparisonDelta(
      currentSummary.byBucket.blocked,
      previousSummary.byBucket.blocked,
    ),
    comments: buildComparisonDelta(
      currentSummary.contribution.totalUserComments,
      previousSummary.contribution.totalUserComments,
    ),
  };
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

  const connectedProviderCount = requestedProviders.filter((provider) =>
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

const buildTrendSeries = (
  summary: ReportSummary,
  comparison: ReportComparisonSummary,
): TrendPoint[] => {
  if (!comparison.available || !comparison.completed || !comparison.active ||
    !comparison.blocked) {
    return [];
  }

  return [
    {
      label: "Previous",
      completed: comparison.completed.previous,
      active: comparison.active.previous,
      blocked: comparison.blocked.previous,
    },
    {
      label: "Current",
      completed: summary.byBucket.completed,
      active: summary.byBucket.active,
      blocked: summary.byBucket.blocked,
    },
  ];
};

export const buildRunReport = async (
  providerIssues: Partial<Record<ProviderName, unknown[]>>,
  context: ReportContext,
  options: ReportBuildOptions = {},
): Promise<RunReport> => {
  const generatedAt = context.generatedAt ?? new Date().toISOString();
  const usernames = context.usernames ?? {};
  const normalizedIssuesBase: NormalizedIssue[] = [];
  const previousProviderIssues = options.previousProviderIssues ?? {};
  const previousNormalizedBase: NormalizedIssue[] = [];

  for (const provider of Object.keys(providerIssues) as ProviderName[]) {
    normalizedIssuesBase.push(
      ...normalizeProviderIssues(
        provider,
        providerIssues[provider] ?? [],
        usernames[provider],
      ),
    );
  }

  for (
    const provider of Object.keys(previousProviderIssues) as ProviderName[]
  ) {
    previousNormalizedBase.push(
      ...normalizeProviderIssues(
        provider,
        previousProviderIssues[provider] ?? [],
        usernames[provider],
      ),
    );
  }

  const normalizedIssues = applyIssueScoring(
    normalizedIssuesBase,
    context.endDate,
  )
    .sort(compareIssues);
  const previousNormalizedIssues = applyIssueScoring(
    previousNormalizedBase,
    context.endDate,
  ).sort(compareIssues);

  const summary = buildReportSummary(normalizedIssues, context.reportProfile);
  const comparison = buildComparisonSummary(
    normalizedIssues,
    previousNormalizedIssues,
  );
  const coverage = buildCoverageSummary(summary, options.diagnostics);
  const providerDistribution = buildProviderDistribution(summary.byProvider);
  const trendSeries = buildTrendSeries(summary, comparison);
  const narrative = await buildNarrativeWithAi(summary, context, coverage);
  const settings = PROFILE_SETTINGS[context.reportProfile];
  const appendixIssues = normalizedIssues.slice(0, settings.appendix);

  const markdown = buildReportMarkdown(
    summary,
    narrative,
    { ...context, generatedAt },
    appendixIssues,
    comparison,
    coverage,
  );
  const html = await buildShadcnPackageHtml(
    summary,
    narrative,
    { ...context, generatedAt },
    appendixIssues,
    comparison,
    coverage,
    providerDistribution,
    trendSeries,
  );

  return {
    normalizedIssues,
    summary,
    comparison,
    coverage,
    providerDistribution,
    trendSeries,
    markdown,
    html,
    reportFormat: context.reportFormat,
    narrative,
  };
};

export const writeRunReport = async (
  report: RunReport,
): Promise<
  { markdownPath?: string; htmlPath?: string; normalizedPath: string }
> => {
  const outputDir = "output";
  await Deno.mkdir(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:]/g, "-");
  const normalizedPath = `${outputDir}/${timestamp}-normalized.json`;
  const htmlPath = `${outputDir}/${timestamp}-summary.html`;

  const normalizedIssuesForJson = report.normalizedIssues.map(
    ({ descriptionSnippet: _descriptionSnippet, ...issue }) => issue,
  );

  await Deno.writeTextFile(
    normalizedPath,
    JSON.stringify(normalizedIssuesForJson, null, 2),
  );
  await Deno.writeTextFile(htmlPath, report.html);
  const keepFiles = new Set([
    normalizedPath.slice(outputDir.length + 1),
    htmlPath.slice(outputDir.length + 1),
  ]);

  for await (const entry of Deno.readDir(outputDir)) {
    if (!entry.isFile) {
      await Deno.remove(`${outputDir}/${entry.name}`, { recursive: true });
      continue;
    }
    if (keepFiles.has(entry.name)) continue;
    await Deno.remove(`${outputDir}/${entry.name}`);
  }

  return {
    markdownPath: undefined,
    htmlPath,
    normalizedPath,
  };
};

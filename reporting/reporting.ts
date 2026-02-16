import { ProviderName } from "../providers/types.ts";

export interface NormalizedIssue {
  id: string;
  provider: ProviderName;
  sourceId: string;
  key: string;
  title: string;
  state: string;
  createdAt: string;
  updatedAt: string;
  author?: string;
  assignees: string[];
  labels: string[];
  commentCount: number;
  url?: string;
}

export interface ReportSummary {
  totalIssues: number;
  byProvider: Record<ProviderName, number>;
  byState: Record<string, number>;
  topLabels: Array<{ label: string; count: number }>;
  latestUpdated: Array<
    Pick<NormalizedIssue, "provider" | "key" | "title" | "state" | "updatedAt">
  >;
}

export interface RunReport {
  normalizedIssues: NormalizedIssue[];
  summary: ReportSummary;
  markdown: string;
}

const toStringOrEmpty = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
};

const normalizeGitLabIssue = (raw: any): NormalizedIssue => {
  const sourceId = toStringOrEmpty(raw.id);
  const iid = toStringOrEmpty(raw.iid);
  return {
    id: `gitlab:${sourceId}`,
    provider: "gitlab",
    sourceId,
    key: iid ? `GL-${iid}` : sourceId,
    title: toStringOrEmpty(raw.title) || "(untitled)",
    state: toStringOrEmpty(raw.state) || "unknown",
    createdAt: toStringOrEmpty(raw.created_at),
    updatedAt: toStringOrEmpty(raw.updated_at),
    author: toStringOrEmpty(raw.author?.username || raw.author?.name),
    assignees: Array.isArray(raw.assignees)
      ? raw.assignees
        .map((a: any) => toStringOrEmpty(a?.username || a?.name))
        .filter(Boolean)
      : [],
    labels: Array.isArray(raw.labels)
      ? raw.labels.map((label: unknown) => toStringOrEmpty(label)).filter(
        Boolean,
      )
      : [],
    commentCount: Array.isArray(raw.notes) ? raw.notes.length : 0,
    url: toStringOrEmpty(raw.web_url),
  };
};

const normalizeJiraIssue = (raw: any): NormalizedIssue => {
  const sourceId = toStringOrEmpty(raw.id);
  const key = toStringOrEmpty(raw.key) || sourceId;
  return {
    id: `jira:${sourceId}`,
    provider: "jira",
    sourceId,
    key,
    title: toStringOrEmpty(raw.fields?.summary) || "(untitled)",
    state: toStringOrEmpty(raw.fields?.status?.name) || "unknown",
    createdAt: toStringOrEmpty(raw.fields?.created),
    updatedAt: toStringOrEmpty(raw.fields?.updated),
    author: toStringOrEmpty(raw.fields?.reporter?.displayName),
    assignees: raw.fields?.assignee?.displayName
      ? [toStringOrEmpty(raw.fields.assignee.displayName)]
      : [],
    labels: Array.isArray(raw.fields?.labels)
      ? raw.fields.labels.map((label: unknown) => toStringOrEmpty(label))
        .filter(Boolean)
      : [],
    commentCount: Array.isArray(raw.notes) ? raw.notes.length : 0,
    url: toStringOrEmpty(raw.self),
  };
};

const normalizeGitHubIssue = (raw: any): NormalizedIssue => {
  const sourceId = toStringOrEmpty(raw.id);
  const number = toStringOrEmpty(raw.number);
  return {
    id: `github:${sourceId}`,
    provider: "github",
    sourceId,
    key: number ? `GH-${number}` : sourceId,
    title: toStringOrEmpty(raw.title) || "(untitled)",
    state: toStringOrEmpty(raw.state) || "unknown",
    createdAt: toStringOrEmpty(raw.created_at),
    updatedAt: toStringOrEmpty(raw.updated_at),
    author: toStringOrEmpty(raw.user?.login),
    assignees: Array.isArray(raw.assignees)
      ? raw.assignees.map((a: any) => toStringOrEmpty(a?.login)).filter(Boolean)
      : [],
    labels: Array.isArray(raw.labels)
      ? raw.labels.map((label: any) => toStringOrEmpty(label?.name)).filter(
        Boolean,
      )
      : [],
    commentCount: Number.isFinite(raw.comments)
      ? Number(raw.comments)
      : Array.isArray(raw.notes)
      ? raw.notes.length
      : 0,
    url: toStringOrEmpty(raw.html_url),
  };
};

export const normalizeProviderIssues = (
  provider: ProviderName,
  issues: unknown[],
): NormalizedIssue[] => {
  if (provider === "gitlab") {
    return issues.map((issue) => normalizeGitLabIssue(issue));
  }
  if (provider === "jira") {
    return issues.map((issue) => normalizeJiraIssue(issue));
  }
  return issues.map((issue) => normalizeGitHubIssue(issue));
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
  const labelCounts = new Map<string, number>();

  for (const issue of normalizedIssues) {
    byProvider[issue.provider]++;
    byState[issue.state] = (byState[issue.state] ?? 0) + 1;
    for (const label of issue.labels) {
      labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
    }
  }

  const topLabels = [...labelCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const latestUpdated = [...normalizedIssues]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5)
    .map((issue) => ({
      provider: issue.provider,
      key: issue.key,
      title: issue.title,
      state: issue.state,
      updatedAt: issue.updatedAt,
    }));

  return {
    totalIssues: normalizedIssues.length,
    byProvider,
    byState,
    topLabels,
    latestUpdated,
  };
};

export const buildReportMarkdown = (
  summary: ReportSummary,
  context: { startDate: string; endDate: string; fetchMode: string },
): string => {
  const lines: string[] = [
    "# Issue Activity Summary",
    "",
    `- Window: ${context.startDate} -> ${context.endDate}`,
    `- Fetch Mode: ${context.fetchMode}`,
    `- Total Issues: ${summary.totalIssues}`,
    "",
    "## By Provider",
    `- GitLab: ${summary.byProvider.gitlab}`,
    `- Jira: ${summary.byProvider.jira}`,
    `- GitHub: ${summary.byProvider.github}`,
    "",
    "## By State",
  ];

  for (const [state, count] of Object.entries(summary.byState)) {
    lines.push(`- ${state}: ${count}`);
  }

  lines.push("", "## Top Labels");
  if (!summary.topLabels.length) {
    lines.push("- (none)");
  } else {
    for (const entry of summary.topLabels) {
      lines.push(`- ${entry.label}: ${entry.count}`);
    }
  }

  lines.push("", "## Recently Updated");
  if (!summary.latestUpdated.length) {
    lines.push("- (none)");
  } else {
    for (const issue of summary.latestUpdated) {
      lines.push(
        `- [${issue.provider}] ${issue.key} (${issue.state}) - ${issue.title} @ ${issue.updatedAt}`,
      );
    }
  }

  lines.push("");
  return lines.join("\n");
};

export const buildRunReport = (
  providerIssues: Partial<Record<ProviderName, unknown[]>>,
  context: { startDate: string; endDate: string; fetchMode: string },
): RunReport => {
  const normalizedIssues: NormalizedIssue[] = [];

  for (const provider of Object.keys(providerIssues) as ProviderName[]) {
    normalizedIssues.push(
      ...normalizeProviderIssues(provider, providerIssues[provider] ?? []),
    );
  }

  const summary = buildReportSummary(normalizedIssues);
  const markdown = buildReportMarkdown(summary, context);
  return { normalizedIssues, summary, markdown };
};

export const writeRunReport = async (
  report: RunReport,
): Promise<{ markdownPath: string; normalizedPath: string }> => {
  const reportsDir = "output/reports";
  await Deno.mkdir(reportsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:]/g, "-");
  const markdownPath = `${reportsDir}/${timestamp}-summary.md`;
  const normalizedPath = `${reportsDir}/${timestamp}-normalized.json`;

  await Deno.writeTextFile(markdownPath, report.markdown);
  await Deno.writeTextFile(
    normalizedPath,
    JSON.stringify(report.normalizedIssues, null, 2),
  );

  return { markdownPath, normalizedPath };
};

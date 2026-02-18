import React from "react";
import process from "node:process";
import { renderToStaticMarkup } from "react-dom/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import styles from "./styles.css?inline";

type ActivityBucket = "completed" | "active" | "blocked" | "other";
type ProviderName = "gitlab" | "jira" | "github";

interface ReportIssueView {
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

interface ReportSummary {
  totalIssues: number;
  byProvider: Record<ProviderName, number>;
  byBucket: Record<ActivityBucket, number>;
  highPriorityLabelIssues: number;
  contribution: {
    contributedIssues: number;
    totalUserComments: number;
  };
  topActivityHighlights: ReportIssueView[];
  collaborationHighlights: ReportIssueView[];
  risksAndFollowUps: ReportIssueView[];
}

interface WeeklyTalkingPoint {
  lead: string;
  bullets: string[];
}

interface NarrativeSections {
  executiveHeadline: string;
  topHighlightWording: string[];
  collaborationHighlights: string[];
  risksAndFollowUps: string[];
  weeklyTalkingPoints: WeeklyTalkingPoint[];
}

interface ReportContext {
  startDate: string;
  endDate: string;
  fetchMode: string;
  reportProfile: string;
  generatedAt?: string;
  sourceMode?: "fetch" | "report";
}

interface ReportCoverageSummary {
  sourceMode: "fetch" | "report";
  requestedProviders: ProviderName[];
  successfulProviders: ProviderName[];
  failedProviders: ProviderName[];
  connectedProviderCount: number;
  totalProviderCount: number;
  partialFailures: number;
}

interface NormalizedIssue {
  key: string;
  provider: ProviderName;
  title: string;
  state: string;
  bucket: ActivityBucket;
  impactScore: number;
  updatedAt: string;
  isAuthoredByUser: boolean;
  isAssignedToUser: boolean;
  isCommentedByUser: boolean;
  userCommentCount: number;
  labels?: string[];
  url?: string;
}

interface RenderPayload {
  summary: ReportSummary;
  narrative: NarrativeSections;
  context: ReportContext;
  normalizedIssues: NormalizedIssue[];
  coverage: ReportCoverageSummary;
  providerDistribution: Array<{ provider: ProviderName; count: number }>;
}

const PROVIDER_LABEL: Record<ProviderName, string> = {
  github: "GitHub",
  gitlab: "GitLab",
  jira: "Jira",
};

const BUCKET_LABEL: Record<ActivityBucket, string> = {
  completed: "Completed",
  active: "Active",
  blocked: "Blocked",
  other: "Other",
};

function formatHumanDateTime(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(parsed));
}

function formatHumanDate(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(parsed));
}

function bucketToneClass(bucket: ActivityBucket): string {
  if (bucket === "completed") return "border-l-4 border-l-emerald-400";
  if (bucket === "active") return "border-l-4 border-l-sky-400";
  if (bucket === "blocked") return "border-l-4 border-l-amber-400";
  return "border-l-4 border-l-slate-400";
}

function bucketBadgeClass(bucket: ActivityBucket): string {
  if (bucket === "completed") {
    return "border-emerald-300/35 bg-emerald-500/15 text-emerald-200";
  }
  if (bucket === "active") {
    return "border-sky-300/35 bg-sky-500/15 text-sky-200";
  }
  if (bucket === "blocked") {
    return "border-amber-300/35 bg-amber-500/15 text-amber-200";
  }
  return "border-slate-300/35 bg-slate-500/15 text-slate-200";
}

function parseRiskLine(value: string): { context: string; action: string } {
  const match = value.match(/^\[([^\]]+)\]\s*(.+)$/);
  if (!match) return { context: "Follow-up", action: value };
  return { context: match[1], action: match[2] };
}

function InsightMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <Card className="bg-secondary/45">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function buildClientScript() {
  return `
(() => {
  const init = () => {
    const root = document.querySelector('[data-root]');
    if (!root) return;

    const state = {
      provider: 'all',
      query: '',
      filterState: 'all',
      filterImpact: 'all',
    };

    const bySel = (sel) => Array.from(document.querySelectorAll(sel));

    const rowMatchesFilters = (row) => {
      const provider = row.getAttribute('data-provider') || '';
      const issueState = (row.getAttribute('data-state') || '').toLowerCase();
      const impact = Number(row.getAttribute('data-impact') || '0');
      const text = (row.textContent || '').toLowerCase();
      const matchesProvider = state.provider === 'all' || provider === state.provider;
      const matchesState = state.filterState === 'all' || issueState.includes(state.filterState);
      const matchesImpact = state.filterImpact === 'all'
        || (state.filterImpact === 'high' && impact >= 80)
        || (state.filterImpact === 'medium' && impact >= 50 && impact < 80)
        || (state.filterImpact === 'low' && impact < 50);
      const matchesQuery = state.query.length === 0 || text.includes(state.query);
      return matchesProvider && matchesState && matchesImpact && matchesQuery;
    };

    const updateVisibleCount = (visible, total) => {
      const counter = document.querySelector('[data-visible-count]');
      if (counter) {
        counter.textContent = 'Showing ' + visible + ' of ' + total + ' issues';
      }
    };

    const renderVisibility = () => {
      const rows = bySel('[data-row]');
      let visible = 0;
      rows.forEach((row) => {
        const matches = rowMatchesFilters(row);
        row.style.display = matches ? '' : 'none';
        if (matches) visible += 1;
      });
      updateVisibleCount(visible, rows.length);
    };

    const providerFilter = document.querySelector('[data-filter-provider]');
    if (providerFilter) {
      providerFilter.addEventListener('change', (event) => {
        const target = event.target;
        state.provider = target && target.value ? String(target.value) : 'all';
        renderVisibility();
      });
    }

    const stateFilter = document.querySelector('[data-filter-state]');
    if (stateFilter) {
      stateFilter.addEventListener('change', (event) => {
        const target = event.target;
        state.filterState = target && target.value ? String(target.value) : 'all';
        renderVisibility();
      });
    }

    const impactFilter = document.querySelector('[data-filter-impact]');
    if (impactFilter) {
      impactFilter.addEventListener('change', (event) => {
        const target = event.target;
        state.filterImpact = target && target.value ? String(target.value) : 'all';
        renderVisibility();
      });
    }

    const search = document.querySelector('[data-search]');
    if (search) {
      search.addEventListener('input', (event) => {
        const target = event.target;
        state.query = target && target.value ? String(target.value).trim().toLowerCase() : '';
        renderVisibility();
      });
    }

    const exportCsv = document.querySelector('[data-export-csv]');
    if (exportCsv) {
      exportCsv.addEventListener('click', () => {
        const visibleRows = bySel('[data-row]').filter((row) => row.style.display !== 'none');
        const headers = [
          'Rank',
          'Issue',
          'Title',
          'Provider',
          'State',
          'Bucket',
          'Impact',
          'Updated',
          'User comments',
          'Authored',
          'Assigned',
          'Commented',
          'Labels',
          'URL',
        ];
        const data = visibleRows.map((row) => [
          row.getAttribute('data-rank') || '',
          row.getAttribute('data-key') || '',
          row.getAttribute('data-title') || '',
          row.getAttribute('data-provider-label') || '',
          row.getAttribute('data-state') || '',
          row.getAttribute('data-bucket') || '',
          row.getAttribute('data-impact') || '',
          row.getAttribute('data-updated') || '',
          row.getAttribute('data-comments') || '',
          row.getAttribute('data-authored') || '',
          row.getAttribute('data-assigned') || '',
          row.getAttribute('data-commented') || '',
          row.getAttribute('data-labels') || '',
          row.getAttribute('data-url') || '',
        ]);
        const csv = [headers, ...data]
          .map((line) => line.map((cell) => '"' + String(cell).replaceAll('"', '""') + '"').join(','))
          .join('\\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'activity-report.csv';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      });
    }

    renderVisibility();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
`;
}

function ReportDocument({ payload }: { payload: RenderPayload }) {
  const {
    summary,
    narrative,
    context,
    normalizedIssues,
    coverage,
    providerDistribution,
  } = payload;

  const windowLabel = `${formatHumanDate(context.startDate)} -> ${
    formatHumanDate(context.endDate)
  }`;
  const generatedAt = formatHumanDateTime(
    context.generatedAt ?? new Date().toISOString(),
  );

  const completionRate = summary.totalIssues > 0
    ? Math.round((summary.byBucket.completed / summary.totalIssues) * 100)
    : 0;
  const contributionRate = summary.totalIssues > 0
    ? Math.round(
      (summary.contribution.contributedIssues / summary.totalIssues) * 100,
    )
    : 0;
  const maxProviderCount = Math.max(
    1,
    ...providerDistribution.map((entry) => entry.count),
  );
  const coverageNote = coverage.partialFailures
    ? `${coverage.partialFailures} provider failure${
      coverage.partialFailures === 1 ? "" : "s"
    } occurred during data collection.`
    : "All requested providers returned data for this reporting window.";

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Activity Report</title>
        <style dangerouslySetInnerHTML={{ __html: styles }} />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <main
          className="mx-auto w-full max-w-[1320px] space-y-4 p-4 md:p-6"
          data-root="true"
        >
          <Card className="bg-card/90">
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-3xl tracking-tight">
                    Activity Report
                  </CardTitle>
                  <CardDescription className="mt-2 text-xs">
                    Window: {windowLabel} | Generated: {generatedAt}
                  </CardDescription>
                </div>
                <p className="text-xs text-muted-foreground">
                  Source: {context.sourceMode ?? "report"} | Fetch mode: {" "}
                  {context.fetchMode}
                </p>
              </div>
              <Separator />
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <nav className="flex flex-wrap gap-2 text-xs" aria-label="Jump to section">
                  <a
                    className="rounded-full border border-border bg-secondary/40 px-3 py-1 hover:bg-secondary"
                    href="#summary"
                  >
                    Summary
                  </a>
                  <a
                    className="rounded-full border border-border bg-secondary/40 px-3 py-1 hover:bg-secondary"
                    href="#highlights"
                  >
                    Highlights
                  </a>
                  <a
                    className="rounded-full border border-border bg-secondary/40 px-3 py-1 hover:bg-secondary"
                    href="#talking-points"
                  >
                    Talking Points
                  </a>
                  <a
                    className="rounded-full border border-border bg-secondary/40 px-3 py-1 hover:bg-secondary"
                    href="#appendix"
                  >
                    All Issues
                  </a>
                </nav>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    Providers connected: {coverage.connectedProviderCount}/
                    {coverage.totalProviderCount}
                  </span>
                  <Button type="button" size="sm" variant="secondary" data-export-csv>
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          <section id="summary">
            <Card>
              <CardHeader>
                <CardTitle>Executive Summary</CardTitle>
                <CardDescription>
                  This report shows activity only for the selected current window.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-6">{narrative.executiveHeadline}</p>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <InsightMetric
                    label="Total Issues"
                    value={summary.totalIssues}
                    detail={`${summary.byBucket.completed} completed / ${summary.byBucket.active} active / ${summary.byBucket.blocked} blocked`}
                  />
                  <InsightMetric
                    label="Contribution"
                    value={`${contributionRate}%`}
                    detail={`${summary.contribution.contributedIssues} contributed issues and ${summary.contribution.totalUserComments} user comments`}
                  />
                  <InsightMetric
                    label="High Priority"
                    value={summary.highPriorityLabelIssues}
                    detail="Issues carrying high-impact labels"
                  />
                  <InsightMetric
                    label="Collection Health"
                    value={`${coverage.successfulProviders.length}/${coverage.requestedProviders.length}`}
                    detail={coverageNote}
                  />
                </div>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Provider Mix
                  </h3>
                  {providerDistribution.length
                    ? providerDistribution.map((entry) => {
                      const width = Math.round((entry.count / maxProviderCount) * 100);
                      return (
                        <div
                          key={entry.provider}
                          className="rounded-lg border border-border bg-secondary/35 px-3 py-2"
                        >
                          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                            <span>{PROVIDER_LABEL[entry.provider]}</span>
                            <span className="font-mono">{entry.count}</span>
                          </div>
                          <div className="h-2 rounded-full bg-background/70">
                            <div
                              className="h-2 rounded-full bg-primary"
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                    : <p className="text-sm text-muted-foreground">No provider distribution available.</p>}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <InsightMetric
                    label="Completion Rate"
                    value={`${completionRate}%`}
                    detail={`${summary.byBucket.completed} of ${summary.totalIssues} issues completed`}
                  />
                  <InsightMetric
                    label="GitHub / GitLab / Jira"
                    value={`${summary.byProvider.github} / ${summary.byProvider.gitlab} / ${summary.byProvider.jira}`}
                    detail="Issue count by provider"
                  />
                  <InsightMetric
                    label="Contributed Issues"
                    value={summary.contribution.contributedIssues}
                    detail="Issues where the user authored, was assigned, or commented"
                  />
                  <InsightMetric
                    label="Total User Comments"
                    value={summary.contribution.totalUserComments}
                    detail="Direct comments made by the user in this window"
                  />
                </div>
              </CardContent>
            </Card>
          </section>

          <section id="highlights">
            <Card>
              <CardHeader>
                <CardTitle>Highlights and Risks</CardTitle>
                <CardDescription>
                  Top Highlights, Risks and Follow-ups, and Collaboration are all visible on this page.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 lg:grid-cols-3">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Top Highlights
                  </h3>
                  {summary.topActivityHighlights.length
                    ? summary.topActivityHighlights.map((issue, index) => {
                      const wording = narrative.topHighlightWording[index] ??
                        issue.descriptionSnippet;
                      return (
                        <Card
                          key={`${issue.provider}-${issue.key}`}
                          className={`${bucketToneClass(issue.bucket)} bg-secondary/40`}
                        >
                          <CardContent className="space-y-2 p-3">
                            <p className="text-sm font-semibold">
                              {PROVIDER_LABEL[issue.provider]} · {issue.key}
                            </p>
                            <p className="text-sm">{issue.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {issue.state} · Updated {formatHumanDateTime(issue.updatedAt)} · Impact {issue.impactScore}
                            </p>
                            <p className="text-sm leading-6">{wording}</p>
                          </CardContent>
                        </Card>
                      );
                    })
                    : (
                      <Card className="border-dashed bg-secondary/30">
                        <CardContent className="p-3 text-sm text-muted-foreground">
                          No highlights selected for this window.
                        </CardContent>
                      </Card>
                    )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Risks and Follow-ups
                  </h3>
                  {narrative.risksAndFollowUps.length
                    ? narrative.risksAndFollowUps.map((line, index) => {
                      const parsed = parseRiskLine(line);
                      return (
                        <Card
                          key={`${line}-${index}`}
                          className="border-l-4 border-l-amber-400 bg-secondary/40"
                        >
                          <CardContent className="space-y-1 p-3">
                            <p className="text-sm font-semibold">{parsed.context}</p>
                            <p className="text-sm leading-6">{parsed.action}</p>
                          </CardContent>
                        </Card>
                      );
                    })
                    : (
                      <Card className="border-dashed bg-secondary/30">
                        <CardContent className="p-3 text-sm text-muted-foreground">
                          No immediate follow-up actions required.
                        </CardContent>
                      </Card>
                    )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Collaboration
                  </h3>
                  {summary.collaborationHighlights.length
                    ? summary.collaborationHighlights.map((issue, index) => {
                      const wording = narrative.collaborationHighlights[index];
                      return (
                        <Card
                          key={`${issue.provider}-${issue.key}`}
                          className={`${bucketToneClass(issue.bucket)} bg-secondary/40`}
                        >
                          <CardContent className="space-y-2 p-3">
                            <p className="text-sm font-semibold">
                              {PROVIDER_LABEL[issue.provider]} · {issue.key}
                            </p>
                            <p className="text-sm">{issue.title}</p>
                            <p className="text-xs text-muted-foreground">
                              Comments by user: {issue.userCommentCount} · Impact {issue.impactScore}
                            </p>
                            {wording ? <p className="text-sm leading-6">{wording}</p> : null}
                          </CardContent>
                        </Card>
                      );
                    })
                    : (
                      <Card className="border-dashed bg-secondary/30">
                        <CardContent className="p-3 text-sm text-muted-foreground">
                          No collaboration highlights for this window.
                        </CardContent>
                      </Card>
                    )}
                </div>
              </CardContent>
            </Card>
          </section>

          <section id="talking-points">
            <Card>
              <CardHeader>
                <CardTitle>Talking Points</CardTitle>
                <CardDescription>
                  Suggested discussion bullets for this reporting window.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {narrative.weeklyTalkingPoints.length
                  ? narrative.weeklyTalkingPoints.slice(0, 5).map((point, index) => (
                    <Card key={`${point.lead}-${index}`} className="bg-secondary/35">
                      <CardContent className="space-y-2 p-3">
                        <p className="text-sm font-semibold">{point.lead}</p>
                        <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                          {point.bullets.slice(0, 5).map((bullet, bulletIndex) => (
                            <li key={`${bullet}-${bulletIndex}`}>{bullet}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  ))
                  : (
                    <Card className="border-dashed bg-secondary/30">
                      <CardContent className="p-3 text-sm text-muted-foreground">
                        No talking points generated.
                      </CardContent>
                    </Card>
                  )}
              </CardContent>
            </Card>
          </section>

          <section id="appendix">
            <Card>
              <CardHeader>
                <CardTitle>Appendix</CardTitle>
                <CardDescription>
                  Full issue list with inline details and client-side filters.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 lg:grid-cols-[1.6fr_repeat(3,minmax(0,0.9fr))_auto]">
                  <Input
                    className="h-9"
                    data-search
                    placeholder="Search issue or title"
                  />
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    data-filter-provider
                  >
                    <option value="all">Provider: All</option>
                    <option value="github">GitHub</option>
                    <option value="gitlab">GitLab</option>
                    <option value="jira">Jira</option>
                  </select>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    data-filter-state
                  >
                    <option value="all">State: Any</option>
                    <option value="open">Open</option>
                    <option value="closed">Closed/Done</option>
                    <option value="blocked">Blocked</option>
                  </select>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    data-filter-impact
                  >
                    <option value="all">Impact: Any</option>
                    <option value="high">High (80+)</option>
                    <option value="medium">Medium (50-79)</option>
                    <option value="low">Low (&lt;50)</option>
                  </select>
                  <div
                    className="self-center justify-self-start text-xs text-muted-foreground lg:justify-self-end"
                    data-visible-count
                  >
                    Showing {normalizedIssues.length} of {normalizedIssues.length} issues
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-border bg-card/70">
                  <Table className="min-w-[1450px]">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="sticky top-0 z-10 bg-card">Rank</TableHead>
                        <TableHead className="sticky top-0 z-10 bg-card">Issue</TableHead>
                        <TableHead className="sticky top-0 z-10 bg-card min-w-60">Title</TableHead>
                        <TableHead className="sticky top-0 z-10 bg-card">Provider</TableHead>
                        <TableHead className="sticky top-0 z-10 bg-card">State</TableHead>
                        <TableHead className="sticky top-0 z-10 bg-card">Bucket</TableHead>
                        <TableHead className="sticky top-0 z-10 bg-card">Impact</TableHead>
                        <TableHead className="sticky top-0 z-10 bg-card">Updated</TableHead>
                        <TableHead className="sticky top-0 z-10 bg-card">User Comments</TableHead>
                        <TableHead className="sticky top-0 z-10 bg-card">Authored</TableHead>
                        <TableHead className="sticky top-0 z-10 bg-card">Assigned</TableHead>
                        <TableHead className="sticky top-0 z-10 bg-card">Commented</TableHead>
                        <TableHead className="sticky top-0 z-10 bg-card min-w-52">Labels</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {normalizedIssues.length
                        ? normalizedIssues.map((issue, index) => {
                          const labels = (issue.labels ?? []).join(", ") || "none";
                          const updated = formatHumanDateTime(issue.updatedAt);
                          return (
                            <TableRow
                              key={`${issue.provider}-${issue.key}-${index}`}
                              data-row
                              data-rank={index + 1}
                              data-provider={issue.provider}
                              data-provider-label={PROVIDER_LABEL[issue.provider]}
                              data-key={issue.key}
                              data-title={issue.title}
                              data-state={issue.state}
                              data-bucket={issue.bucket}
                              data-impact={issue.impactScore}
                              data-updated={updated}
                              data-authored={issue.isAuthoredByUser ? "yes" : "no"}
                              data-assigned={issue.isAssignedToUser ? "yes" : "no"}
                              data-commented={issue.isCommentedByUser ? "yes" : "no"}
                              data-comments={issue.userCommentCount}
                              data-labels={labels}
                              data-url={issue.url ?? ""}
                            >
                              <TableCell className="font-mono">{index + 1}</TableCell>
                              <TableCell>
                                {issue.url
                                  ? (
                                    <a
                                      href={issue.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="font-medium underline-offset-4 hover:underline"
                                    >
                                      {issue.key}
                                    </a>
                                  )
                                  : issue.key}
                              </TableCell>
                              <TableCell className="text-foreground/90">{issue.title}</TableCell>
                              <TableCell>{PROVIDER_LABEL[issue.provider]}</TableCell>
                              <TableCell>{issue.state}</TableCell>
                              <TableCell>
                                <Badge className={bucketBadgeClass(issue.bucket)} variant="outline">
                                  {BUCKET_LABEL[issue.bucket]}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono">{issue.impactScore}</TableCell>
                              <TableCell>{updated}</TableCell>
                              <TableCell className="font-mono">{issue.userCommentCount}</TableCell>
                              <TableCell className="font-mono">
                                {issue.isAuthoredByUser ? "yes" : "no"}
                              </TableCell>
                              <TableCell className="font-mono">
                                {issue.isAssignedToUser ? "yes" : "no"}
                              </TableCell>
                              <TableCell className="font-mono">
                                {issue.isCommentedByUser ? "yes" : "no"}
                              </TableCell>
                              <TableCell className="text-muted-foreground">{labels}</TableCell>
                            </TableRow>
                          );
                        })
                        : (
                          <TableRow>
                            <TableCell colSpan={13}>
                              <Card className="border-dashed bg-secondary/30">
                                <CardContent className="p-3 text-sm text-muted-foreground">
                                  No issues available for this window.
                                </CardContent>
                              </Card>
                            </TableCell>
                          </TableRow>
                        )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </section>
        </main>
        <script dangerouslySetInnerHTML={{ __html: buildClientScript() }} />
      </body>
    </html>
  );
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let raw = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      raw += chunk;
    });
    process.stdin.on("end", () => resolve(raw));
    process.stdin.on("error", reject);
  });
}

async function main() {
  const rawInput = await readStdin();
  const payload = JSON.parse(rawInput) as RenderPayload;
  const html = "<!doctype html>" +
    renderToStaticMarkup(<ReportDocument payload={payload} />);
  process.stdout.write(html);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`shadcn renderer failed: ${message}\\n`);
  process.exit(1);
});

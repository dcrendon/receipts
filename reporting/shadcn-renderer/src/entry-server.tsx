import React from "react";
import process from "node:process";
import { renderToStaticMarkup } from "react-dom/server";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import styles from "./styles.css?inline";

/* ------------------------------------------------------------------ */
/*  Types — mirrors the Deno-side payload                              */
/* ------------------------------------------------------------------ */

type ActivityBucket = "completed" | "active" | "blocked" | "other";
type ProviderName = "gitlab" | "jira" | "github";

interface ContributionSummary {
  contributedIssues: number;
  authoredIssues: number;
  assignedIssues: number;
  commentedIssues: number;
  totalUserComments: number;
}

interface ReportSummary {
  totalIssues: number;
  byProvider: Record<ProviderName, number>;
  byBucket: Record<ActivityBucket, number>;
  highPriorityLabelIssues: number;
  contribution: ContributionSummary;
}

interface ReportContext {
  startDate: string;
  endDate: string;
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
  descriptionSnippet: string;
  url?: string;
}

interface RenderPayload {
  summary: ReportSummary;
  headline: string;
  aiAssisted: boolean;
  context: ReportContext;
  normalizedIssues: NormalizedIssue[];
  coverage: ReportCoverageSummary;
  providerDistribution: Array<{ provider: ProviderName; count: number }>;
}

/* ------------------------------------------------------------------ */
/*  Constants & helpers                                                */
/* ------------------------------------------------------------------ */

const PROVIDER_LABEL: Record<ProviderName, string> = {
  github: "GitHub",
  gitlab: "GitLab",
  jira: "Jira",
};

const BUCKET_LABEL: Record<ActivityBucket, string> = {
  completed: "Done",
  active: "In Progress",
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

function statusBadgeClass(bucket: ActivityBucket): string {
  const map: Record<ActivityBucket, string> = {
    completed: "border-emerald-600/40 bg-emerald-500/15 text-emerald-700 dark:border-emerald-300/35 dark:bg-emerald-500/15 dark:text-emerald-200",
    active: "border-sky-600/40 bg-sky-500/15 text-sky-700 dark:border-sky-300/35 dark:bg-sky-500/15 dark:text-sky-200",
    blocked: "border-amber-600/40 bg-amber-500/15 text-amber-700 dark:border-amber-300/35 dark:bg-amber-500/15 dark:text-amber-200",
    other: "border-slate-400/40 bg-slate-500/10 text-slate-600 dark:border-slate-300/35 dark:bg-slate-500/15 dark:text-slate-200",
  };
  return map[bucket];
}

/* ------------------------------------------------------------------ */
/*  Section components                                                 */
/* ------------------------------------------------------------------ */

function KpiGrid({ summary }: { summary: ReportSummary }) {
  const items: Array<{ label: string; value: number }> = [
    { label: "Total Issues", value: summary.totalIssues },
    { label: "Completed", value: summary.byBucket.completed },
    { label: "Active", value: summary.byBucket.active },
    { label: "Blocked", value: summary.byBucket.blocked },
    { label: "Contributed", value: summary.contribution.contributedIssues },
    { label: "User Comments", value: summary.contribution.totalUserComments },
    { label: "High-Priority", value: summary.highPriorityLabelIssues },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="bg-card/80">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ProviderDistribution({
  distribution,
}: {
  distribution: Array<{ provider: ProviderName; count: number }>;
}) {
  const total = distribution.reduce((sum, d) => sum + d.count, 0) || 1;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {distribution.map((d) => {
        const pct = Math.round((d.count / total) * 100);
        return (
          <Card key={d.provider} className="bg-card/80">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {PROVIDER_LABEL[d.provider]}
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums">{d.count}</p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function CoverageFooter({ coverage }: { coverage: ReportCoverageSummary }) {
  return (
    <Card className="bg-card/60">
      <CardContent className="flex flex-wrap items-center gap-4 p-4 text-xs text-muted-foreground">
        <span>
          Providers: {coverage.connectedProviderCount}/{coverage.totalProviderCount} connected
        </span>
        {coverage.failedProviders.length > 0 && (
          <span className="text-destructive">
            Failed: {coverage.failedProviders.join(", ")}
          </span>
        )}
        <span>Source: {coverage.sourceMode}</span>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main report document                                               */
/* ------------------------------------------------------------------ */

function ReportDocument({ payload }: { payload: RenderPayload }) {
  const { summary, headline, aiAssisted, context, normalizedIssues, coverage, providerDistribution } = payload;

  const windowLabel = `${formatHumanDate(context.startDate)} \u2192 ${formatHumanDate(context.endDate)}`;
  const generatedAt = formatHumanDateTime(context.generatedAt ?? new Date().toISOString());

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Activity Report</title>
        <style dangerouslySetInnerHTML={{ __html: styles }} />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <main className="mx-auto w-full max-w-[1180px] space-y-4 p-4 md:p-6">

          {/* ---- Header ---- */}
          <Card className="bg-card/90">
            <CardHeader>
              <CardTitle className="text-3xl tracking-tight">Activity Report</CardTitle>
              <CardDescription className="mt-1 text-xs">
                {windowLabel} &middot; Generated {generatedAt}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">
                {headline}
              </p>
              {aiAssisted && (
                <p className="mt-1">
                  <Badge variant="outline" className="text-[10px] border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300">
                    AI-assisted
                  </Badge>
                </p>
              )}
            </CardContent>
          </Card>

          {/* ---- KPIs ---- */}
          <section id="kpis">
            <KpiGrid summary={summary} />
          </section>

          {/* ---- Provider Distribution ---- */}
          <section id="providers">
            <ProviderDistribution distribution={providerDistribution} />
          </section>

          <Separator />

          {/* ---- Full Issue List ---- */}
          <section id="issues">
            <Card>
              <CardHeader>
                <CardTitle>All Issues</CardTitle>
                <CardDescription>Complete list of issues for this reporting window.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border border-border bg-card/70">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-12">#</TableHead>
                        <TableHead className="min-w-64">Title</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {normalizedIssues.length ? (
                        normalizedIssues.map((issue, index) => (
                          <TableRow key={`${issue.provider}-${issue.key}-${index}`}>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {index + 1}
                            </TableCell>
                            <TableCell>
                              {issue.url ? (
                                <a
                                  href={issue.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-medium underline-offset-4 hover:underline"
                                >
                                  {issue.title}
                                </a>
                              ) : (
                                <span className="font-medium">{issue.title}</span>
                              )}
                              <span className="ml-2 text-xs text-muted-foreground font-mono">
                                {issue.key}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                              {issue.descriptionSnippet || "\u2014"}
                            </TableCell>
                            <TableCell className="text-xs">{PROVIDER_LABEL[issue.provider]}</TableCell>
                            <TableCell>
                              <Badge className={statusBadgeClass(issue.bucket)} variant="outline">
                                {BUCKET_LABEL[issue.bucket]}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-sm text-muted-foreground">
                            No tickets available for this window.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* ---- Coverage ---- */}
          <section id="coverage">
            <CoverageFooter coverage={coverage} />
          </section>

        </main>
      </body>
    </html>
  );
}

/* ------------------------------------------------------------------ */
/*  Stdin reader + entry                                               */
/* ------------------------------------------------------------------ */

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

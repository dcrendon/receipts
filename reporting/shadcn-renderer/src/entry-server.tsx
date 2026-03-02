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
  topActivityHighlights: ReportIssueView[];
  collaborationHighlights: ReportIssueView[];
  risksAndFollowUps: ReportIssueView[];
  latestUpdated: ReportIssueView[];
  topLabels: Array<{ label: string; count: number }>;
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
  aiAssisted: {
    executiveHeadline: boolean;
    topHighlights: boolean;
    weeklyTalkingPoints: boolean;
  };
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

const IMPACT_LEGEND = [
  { range: "80+", desc: "High-impact activity with strong execution and ownership signals." },
  { range: "50–79", desc: "Meaningful progress with clear contribution momentum." },
  { range: "0–49", desc: "Lower impact or early-stage activity that still needs follow-through." },
];

const SCORE_FORMULA =
  "completed +40, active +20, blocked +10, authored +15, assigned +10, comments +2 each (max +10), high-impact labels +12, updated in last 48h +8.";

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

function AiBadge() {
  return (
    <Badge variant="outline" className="ml-2 text-[10px] border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300">
      AI-assisted
    </Badge>
  );
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

function HighlightCard({
  issue,
  wording,
}: {
  issue: ReportIssueView;
  wording: string;
}) {
  const attribution = [
    issue.isAuthoredByUser ? "authored" : null,
    issue.isAssignedToUser ? "assigned" : null,
    issue.isCommentedByUser
      ? `${issue.userCommentCount} comment${issue.userCommentCount > 1 ? "s" : ""}`
      : null,
  ].filter(Boolean);

  return (
    <Card className="bg-card/80 border-l-4" style={{ borderLeftColor: bucketColor(issue.bucket) }}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
              {PROVIDER_LABEL[issue.provider]}
            </p>
            <p className="mt-1 text-sm font-semibold">
              {issue.url ? (
                <a href={issue.url} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                  {issue.key}
                </a>
              ) : (
                issue.key
              )}
              {" "}
              <span className="font-medium text-foreground/80">{issue.title}</span>
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 font-mono text-xs">
            Impact {issue.impactScore}
          </Badge>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">{wording}</p>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge className={statusBadgeClass(issue.bucket)} variant="outline">
            {BUCKET_LABEL[issue.bucket]}
          </Badge>
          {attribution.length > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {attribution.join(", ")}
            </Badge>
          )}
          {(issue.labels ?? []).slice(0, 4).map((label) => (
            <Badge key={label} variant="secondary" className="text-[10px]">
              #{label}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function bucketColor(bucket: ActivityBucket): string {
  const map: Record<ActivityBucket, string> = {
    completed: "#059669",
    active: "#2563eb",
    blocked: "#ea580c",
    other: "#64748b",
  };
  return map[bucket];
}

function CollaborationSection({
  summary,
  narrative,
}: {
  summary: ReportSummary;
  narrative: NarrativeSections;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Collaboration Highlights</CardTitle>
        <CardDescription>User contribution across tracked issues.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Contributed", value: summary.contribution.contributedIssues },
            { label: "Authored", value: summary.contribution.authoredIssues },
            { label: "Assigned", value: summary.contribution.assignedIssues },
            { label: "Commented", value: summary.contribution.commentedIssues },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-border bg-card/60 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{item.value}</p>
            </div>
          ))}
        </div>

        {narrative.collaborationHighlights.length > 0 && (
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {narrative.collaborationHighlights.map((line, i) => (
              <li key={i} className="rounded-md border border-border bg-card/50 px-3 py-2">
                {line}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RisksSection({ narrative }: { narrative: NarrativeSections }) {
  if (!narrative.risksAndFollowUps.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Risks and Follow-ups</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">No immediate follow-up actions required.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risks and Follow-ups</CardTitle>
        <CardDescription>Action items from blocked or high-impact active work.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2">
          {narrative.risksAndFollowUps.map((line, i) => (
            <li key={i} className="flex gap-3 rounded-md border border-border bg-card/50 p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-xs font-mono font-bold text-destructive">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed">{line}</p>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function TalkingPointsSection({ narrative }: { narrative: NarrativeSections }) {
  if (!narrative.weeklyTalkingPoints.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Weekly Talking Points
          {narrative.aiAssisted.weeklyTalkingPoints && <AiBadge />}
        </CardTitle>
        <CardDescription>Structured points for weekly status updates.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {narrative.weeklyTalkingPoints.map((point, i) => (
            <Card key={i} className="bg-card/60">
              <CardContent className="p-4">
                <p className="text-sm font-semibold">{point.lead}</p>
                {point.bullets.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {point.bullets.map((bullet, j) => (
                      <li key={j}>• {bullet}</li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ImpactLegend() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Impact Legend</CardTitle>
        <CardDescription>How to interpret impact scores shown across this report.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {IMPACT_LEGEND.map((item) => (
            <div key={item.range} className="rounded-lg border border-border bg-card/60 p-3">
              <p className="font-mono text-sm font-bold">{item.range}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold">Score formula:</span> {SCORE_FORMULA}
        </p>
      </CardContent>
    </Card>
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
  const { summary, narrative, context, normalizedIssues, coverage, providerDistribution } = payload;

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
                {windowLabel} &middot; {context.fetchMode} &middot; {context.reportProfile} &middot; Generated {generatedAt}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">
                {narrative.executiveHeadline}
              </p>
              {narrative.aiAssisted.executiveHeadline && (
                <p className="mt-1"><AiBadge /></p>
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

          {/* ---- Top Activity Highlights ---- */}
          <section id="highlights">
            <Card>
              <CardHeader>
                <CardTitle>
                  Top Activity Highlights
                  {narrative.aiAssisted.topHighlights && <AiBadge />}
                </CardTitle>
                <CardDescription>Highest-impact outcomes ranked by score, recency, and ownership.</CardDescription>
              </CardHeader>
              <CardContent>
                {summary.topActivityHighlights.length ? (
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {summary.topActivityHighlights.map((issue, index) => (
                      <HighlightCard
                        key={`${issue.provider}-${issue.key}-${index}`}
                        issue={issue}
                        wording={narrative.topHighlightWording[index] ?? issue.title}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No highlights for this period.</p>
                )}
              </CardContent>
            </Card>
          </section>

          {/* ---- Collaboration ---- */}
          <section id="collaboration">
            <CollaborationSection summary={summary} narrative={narrative} />
          </section>

          {/* ---- Risks ---- */}
          <section id="risks">
            <RisksSection narrative={narrative} />
          </section>

          {/* ---- Talking Points ---- */}
          <section id="talking-points">
            <TalkingPointsSection narrative={narrative} />
          </section>

          <Separator />

          {/* ---- Impact Legend ---- */}
          <section id="impact-legend">
            <ImpactLegend />
          </section>

          {/* ---- Appendix Table ---- */}
          <section id="appendix">
            <Card>
              <CardHeader>
                <CardTitle>Appendix</CardTitle>
                <CardDescription>Full ranked issue list with attribution details.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border border-border bg-card/70">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Ticket</TableHead>
                        <TableHead className="min-w-48">Title</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Impact</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="text-center">Auth</TableHead>
                        <TableHead className="text-center">Asgn</TableHead>
                        <TableHead className="text-center">Cmnt</TableHead>
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
                                  {issue.key}
                                </a>
                              ) : (
                                issue.key
                              )}
                            </TableCell>
                            <TableCell className="text-foreground/90">{issue.title}</TableCell>
                            <TableCell className="text-xs">{PROVIDER_LABEL[issue.provider]}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{issue.state}</TableCell>
                            <TableCell>
                              <Badge className={statusBadgeClass(issue.bucket)} variant="outline">
                                {BUCKET_LABEL[issue.bucket]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">{issue.impactScore}</TableCell>
                            <TableCell className="text-xs">{formatHumanDateTime(issue.updatedAt)}</TableCell>
                            <TableCell className="text-center font-mono text-xs">{issue.isAuthoredByUser ? "\u2713" : "\u2013"}</TableCell>
                            <TableCell className="text-center font-mono text-xs">{issue.isAssignedToUser ? "\u2713" : "\u2013"}</TableCell>
                            <TableCell className="text-center font-mono text-xs">{issue.isCommentedByUser ? "\u2713" : "\u2013"}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={11} className="text-sm text-muted-foreground">
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

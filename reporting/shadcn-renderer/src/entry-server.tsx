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

const MAJOR_STATUS_LABEL: Record<ActivityBucket, string> = {
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

function ReportDocument({ payload }: { payload: RenderPayload }) {
  const { summary, narrative, context, normalizedIssues } = payload;

  const windowLabel = `${formatHumanDate(context.startDate)} -> ${
    formatHumanDate(context.endDate)
  }`;
  const generatedAt = formatHumanDateTime(
    context.generatedAt ?? new Date().toISOString(),
  );

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
          <Card className="bg-card/90">
            <CardHeader>
              <CardTitle className="text-3xl tracking-tight">Activity Report</CardTitle>
              <CardDescription className="mt-2 text-xs">
                Window: {windowLabel} | Generated: {generatedAt}
              </CardDescription>
            </CardHeader>
          </Card>

          <section id="summary">
            <Card>
              <CardHeader>
                <CardTitle>Ticket Summary (AI)</CardTitle>
                <CardDescription>
                  Focused summary for the selected reporting period.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm leading-6">{narrative.executiveHeadline}</p>
                <p className="text-xs text-muted-foreground">
                  Total {summary.totalIssues} tickets | Done {summary.byBucket.completed} | In Progress {summary.byBucket.active} | Blocked {summary.byBucket.blocked}
                </p>
              </CardContent>
            </Card>
          </section>

          <section id="achievements">
            <Card>
              <CardHeader>
                <CardTitle>Major Achievements</CardTitle>
                <CardDescription>
                  Highest-impact outcomes delivered in this period.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {summary.topActivityHighlights.length
                  ? (
                    <ul className="space-y-2 text-sm">
                      {summary.topActivityHighlights.map((issue, index) => {
                        const wording = narrative.topHighlightWording[index] ??
                          (issue.descriptionSnippet || issue.title);
                        return (
                          <li key={`${issue.provider}-${issue.key}-${index}`}>
                            <span className="font-semibold">
                              {issue.key}
                            </span>{" "}
                            <span className="text-muted-foreground">({PROVIDER_LABEL[issue.provider]})</span>
                            {": "}
                            {wording}
                          </li>
                        );
                      })}
                    </ul>
                  )
                  : (
                    <p className="text-sm text-muted-foreground">
                      No major achievements detected for this period.
                    </p>
                  )}
              </CardContent>
            </Card>
          </section>

          <section id="tickets">
            <Card>
              <CardHeader>
                <CardTitle>All Tickets</CardTitle>
                <CardDescription>
                  Quick reference list with ticket links and major status only.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-lg border border-border bg-card/70">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Ticket</TableHead>
                        <TableHead className="min-w-60">Title</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {normalizedIssues.length
                        ? normalizedIssues.map((issue, index) => {
                          const updated = formatHumanDateTime(issue.updatedAt);
                          return (
                            <TableRow key={`${issue.provider}-${issue.key}-${index}`}>
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
                              <TableCell>
                                <Badge className={statusBadgeClass(issue.bucket)} variant="outline">
                                  {MAJOR_STATUS_LABEL[issue.bucket]}
                                </Badge>
                              </TableCell>
                              <TableCell>{updated}</TableCell>
                            </TableRow>
                          );
                        })
                        : (
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
        </main>
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

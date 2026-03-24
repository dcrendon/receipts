import {
  NormalizedIssue,
  ReportCoverageSummary,
  ReportSummary,
} from "./normalizer.ts";
import { NarrativeResult } from "./narrative.ts";
import { ProviderName } from "../providers/types.ts";
import { CommentActivity } from "../shared/types.ts";

export interface RenderData {
  summary: ReportSummary;
  narrative: NarrativeResult;
  normalizedIssues: NormalizedIssue[];
  coverage: ReportCoverageSummary;
  context: { startDate: string; endDate: string; generatedAt: string };
  providerDistribution: Array<{ provider: ProviderName; count: number }>;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

const esc = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
};

const formatDateTime = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Chicago",
  });
};

const formatTime = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Chicago",
  });
};

const providerLabel: Record<ProviderName, string> = {
  gitlab: "GitLab",
  jira: "Jira",
  github: "GitHub",
};

/* ------------------------------------------------------------------ */
/*  Activity timeline builder                                           */
/* ------------------------------------------------------------------ */

const buildTimeline = (
  issues: NormalizedIssue[],
): Map<string, CommentActivity[]> => {
  const all: CommentActivity[] = [];

  for (const issue of issues) {
    for (const ts of issue.commentTimestamps) {
      all.push({
        issueKey: issue.key,
        issueTitle: issue.title,
        provider: issue.provider,
        timestamp: ts,
        url: issue.url,
      });
    }
  }

  all.sort((a, b) => {
    const aMs = Date.parse(a.timestamp) || 0;
    const bMs = Date.parse(b.timestamp) || 0;
    return bMs - aMs;
  });

  const byDate = new Map<string, CommentActivity[]>();
  for (const entry of all) {
    const dateKey = entry.timestamp.slice(0, 10);
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey)!.push(entry);
  }

  return byDate;
};

/* ------------------------------------------------------------------ */
/*  CSS                                                                 */
/* ------------------------------------------------------------------ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=IBM+Plex+Mono:wght@300;400;500&display=swap');

:root {
  /* Canvas */
  --bg-base:      #0d0f14;
  --bg-surface:   #13161e;
  --bg-raised:    #1a1e2a;
  --bg-hover:     #1f2435;
  --border:       rgba(255,255,255,0.07);
  --border-light: rgba(255,255,255,0.04);

  /* Type */
  --text-primary:   #e8eaf0;
  --text-secondary: #8b90a0;
  --text-muted:     #555a6a;
  --font-display:   'Playfair Display', Georgia, serif;
  --font-mono:      'IBM Plex Mono', 'Fira Mono', monospace;

  /* Provider accents */
  --gitlab:   #e2631e;
  --gitlab-bg: rgba(226,99,30,0.12);
  --jira:     #2d9cdb;
  --jira-bg:  rgba(45,156,219,0.12);
  --github:   #9b72cf;
  --github-bg: rgba(155,114,207,0.12);

  /* Bucket states */
  --completed:    #34d399;
  --completed-bg: rgba(52,211,153,0.1);
  --active:       #60a5fa;
  --active-bg:    rgba(96,165,250,0.1);
  --blocked:      #f87171;
  --blocked-bg:   rgba(248,113,113,0.1);
  --other:        #94a3b8;
  --other-bg:     rgba(148,163,184,0.08);

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 40px;
  --space-2xl: 64px;

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html { scroll-behavior: smooth; }

body {
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-primary);
  background-color: var(--bg-base);
  min-height: 100vh;
  /* Subtle grain texture */
  background-image:
    url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
  background-attachment: fixed;
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

.page { max-width: 1100px; margin: 0 auto; padding: var(--space-xl) var(--space-lg); animation: fadeUp 0.5s ease both; }

/* ── Header ─────────────────────────────────────────────────────────── */

.header { padding: var(--space-2xl) 0 var(--space-xl); border-bottom: 1px solid var(--border); margin-bottom: var(--space-xl); }
.header-eyebrow { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-muted); margin-bottom: var(--space-sm); }
.header-title { font-family: var(--font-display); font-size: 42px; font-weight: 700; line-height: 1.15; color: var(--text-primary); margin-bottom: var(--space-md); letter-spacing: -0.5px; }
.header-meta { display: flex; align-items: center; gap: var(--space-md); flex-wrap: wrap; color: var(--text-secondary); font-size: 12px; }
.header-meta-sep { color: var(--text-muted); }
.header-providers { display: flex; gap: var(--space-sm); margin-top: var(--space-md); }

/* ── Badges ──────────────────────────────────────────────────────────── */

.badge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 9px; border-radius: var(--radius-sm);
  font-size: 11px; font-weight: 500; letter-spacing: 0.04em;
  font-family: var(--font-mono);
  border: 1px solid transparent;
  white-space: nowrap;
}
.badge-gitlab   { color: var(--gitlab); background: var(--gitlab-bg); border-color: rgba(226,99,30,0.2); }
.badge-jira     { color: var(--jira);   background: var(--jira-bg);   border-color: rgba(45,156,219,0.2); }
.badge-github   { color: var(--github); background: var(--github-bg); border-color: rgba(155,114,207,0.2); }
.badge-completed { color: var(--completed); background: var(--completed-bg); }
.badge-active    { color: var(--active);    background: var(--active-bg); }
.badge-blocked   { color: var(--blocked);   background: var(--blocked-bg); }
.badge-other     { color: var(--other);     background: var(--other-bg); }
.badge-label     { color: var(--text-secondary); background: rgba(255,255,255,0.05); border-color: var(--border); }

/* ── Section chrome ──────────────────────────────────────────────────── */

.section { margin-bottom: var(--space-2xl); }
.section-header { display: flex; align-items: baseline; gap: var(--space-md); margin-bottom: var(--space-lg); padding-bottom: var(--space-sm); border-bottom: 1px solid var(--border); }
.section-title { font-family: var(--font-display); font-size: 22px; font-weight: 600; color: var(--text-primary); }
.section-count { font-size: 11px; color: var(--text-muted); letter-spacing: 0.06em; }

/* ── AI Narrative ────────────────────────────────────────────────────── */

.narrative { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-xl); }
.narrative-themes { display: flex; gap: var(--space-sm); flex-wrap: wrap; margin-bottom: var(--space-lg); }
.narrative-theme { padding: 5px 12px; border-radius: 20px; font-size: 11px; letter-spacing: 0.06em; font-weight: 500; background: rgba(255,255,255,0.05); border: 1px solid var(--border); color: var(--text-secondary); }
.narrative-summary { font-size: 14px; line-height: 1.75; color: var(--text-secondary); margin-bottom: var(--space-lg); font-family: var(--font-mono); }
.narrative-summary p + p { margin-top: var(--space-md); }
.narrative-accomplishments { list-style: none; display: flex; flex-direction: column; gap: var(--space-sm); }
.narrative-accomplishments li { display: flex; gap: var(--space-sm); color: var(--text-secondary); font-size: 13px; line-height: 1.5; }
.narrative-accomplishments li::before { content: "→"; color: var(--text-muted); flex-shrink: 0; margin-top: 1px; }

/* ── KPI Grid ────────────────────────────────────────────────────────── */

.kpi-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: var(--space-md); }
.kpi-card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: var(--space-lg); }
.kpi-label { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); margin-bottom: var(--space-xs); }
.kpi-value { font-size: 32px; font-weight: 300; color: var(--text-primary); line-height: 1; margin-bottom: var(--space-xs); }
.kpi-value.completed { color: var(--completed); }
.kpi-value.active    { color: var(--active); }
.kpi-value.blocked   { color: var(--blocked); }
.kpi-sub { font-size: 11px; color: var(--text-muted); }

/* ── Timeline ─────────────────────────────────────────────────────────── */

.timeline-day { margin-bottom: var(--space-lg); }
.timeline-date { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); margin-bottom: var(--space-sm); padding-left: var(--space-md); position: relative; }
.timeline-date::before { content: ""; position: absolute; left: 0; top: 50%; width: 6px; height: 1px; background: var(--text-muted); }
.timeline-entries { display: flex; flex-direction: column; gap: 2px; }
.timeline-entry {
  display: flex; align-items: center; gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-surface); border-radius: var(--radius-sm);
  border: 1px solid var(--border-light);
  transition: background 0.15s ease, border-color 0.15s ease;
  text-decoration: none; color: inherit;
}
.timeline-entry:hover { background: var(--bg-hover); border-color: var(--border); }
.timeline-entry-key { font-size: 11px; color: var(--text-muted); min-width: 70px; flex-shrink: 0; }
.timeline-entry-title { flex: 1; font-size: 12px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.timeline-entry-time { font-size: 11px; color: var(--text-muted); flex-shrink: 0; }

/* ── Projects & Issue Cards ──────────────────────────────────────────── */

.project-group { margin-bottom: var(--space-xl); }
.project-name { font-size: 12px; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: var(--space-md); display: flex; align-items: center; gap: var(--space-sm); }
.project-name::after { content: ""; flex: 1; height: 1px; background: var(--border-light); }
.issue-grid { display: flex; flex-direction: column; gap: var(--space-sm); }
.issue-card {
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-md); padding: var(--space-md) var(--space-lg);
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}
.issue-card:hover { background: var(--bg-hover); border-color: rgba(255,255,255,0.12); transform: translateX(2px); }
.issue-card-header { display: flex; align-items: flex-start; gap: var(--space-md); margin-bottom: var(--space-sm); }
.issue-card-key { font-size: 11px; color: var(--text-muted); flex-shrink: 0; padding-top: 2px; }
.issue-card-title { flex: 1; font-size: 13px; font-weight: 500; color: var(--text-primary); line-height: 1.4; }
.issue-card-title a { color: inherit; text-decoration: none; }
.issue-card-title a:hover { color: var(--active); }
.issue-card-meta { display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap; margin-top: var(--space-sm); }
.issue-card-snippet { font-size: 12px; color: var(--text-muted); line-height: 1.5; margin-top: var(--space-sm); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.issue-card-footer { display: flex; align-items: center; gap: var(--space-md); margin-top: var(--space-sm); font-size: 11px; color: var(--text-muted); }
.issue-card-comments { display: flex; align-items: center; gap: 4px; }
.issue-card-updated { margin-left: auto; }

/* ── Contribution flags ──────────────────────────────────────────────── */

.flag { font-size: 10px; padding: 2px 6px; border-radius: 3px; background: rgba(255,255,255,0.04); color: var(--text-muted); border: 1px solid var(--border-light); }
.flag-author   { color: var(--completed); border-color: rgba(52,211,153,0.2); }
.flag-assignee { color: var(--active);    border-color: rgba(96,165,250,0.2); }

/* ── Footer ──────────────────────────────────────────────────────────── */

.footer { border-top: 1px solid var(--border); padding-top: var(--space-xl); margin-top: var(--space-2xl); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-md); color: var(--text-muted); font-size: 11px; }
.footer-brand { letter-spacing: 0.06em; }
.footer-meta { display: flex; gap: var(--space-lg); }

.empty-state { padding: var(--space-xl); text-align: center; color: var(--text-muted); font-size: 12px; background: var(--bg-surface); border-radius: var(--radius-md); border: 1px dashed var(--border); }
`;

/* ------------------------------------------------------------------ */
/*  Section renderers                                                   */
/* ------------------------------------------------------------------ */

const renderHeader = (data: RenderData): string => {
  const { context, coverage, providerDistribution } = data;
  const start = formatDate(context.startDate);
  const end = formatDate(context.endDate);

  const activeDist = providerDistribution.filter((p) => p.count > 0);
  const providerBadges = activeDist
    .map(
      (p) =>
        `<span class="badge badge-${p.provider}">${
          esc(providerLabel[p.provider])
        } · ${p.count}</span>`,
    )
    .join("");

  return `
<header class="header">
  <div class="header-eyebrow">Activity Report</div>
  <h1 class="header-title">${esc(start)} — ${esc(end)}</h1>
  <div class="header-meta">
    <span>${coverage.connectedProviderCount} of ${coverage.totalProviderCount} providers</span>
    <span class="header-meta-sep">·</span>
    <span>Generated <span data-localtime="${esc(context.generatedAt)}" data-localtime-format="datetime">${esc(formatDateTime(context.generatedAt))}</span></span>
  </div>
  ${
    activeDist.length
      ? `<div class="header-providers">${providerBadges}</div>`
      : ""
  }
</header>`;
};

const renderNarrative = (narrative: NarrativeResult): string => {
  if (
    !narrative.summary && !narrative.themes.length &&
    !narrative.accomplishments.length
  ) {
    return "";
  }

  const themes = narrative.themes
    .map((t: string) => `<span class="narrative-theme">${esc(t)}</span>`)
    .join("");

  const paragraphs = narrative.summary
    .split(/\n+/)
    .filter((p: string) => p.trim())
    .map((p: string) => `<p>${esc(p.trim())}</p>`)
    .join("");

  const accomplishments = narrative.accomplishments
    .map((a: string) => `<li>${esc(a)}</li>`)
    .join("");

  return `
<section class="section">
  <div class="section-header">
    <h2 class="section-title">Work Summary</h2>
    <span class="section-count">AI-assisted</span>
  </div>
  <div class="narrative">
    ${themes ? `<div class="narrative-themes">${themes}</div>` : ""}
    ${paragraphs ? `<div class="narrative-summary">${paragraphs}</div>` : ""}
    ${
    accomplishments
      ? `<ul class="narrative-accomplishments">${accomplishments}</ul>`
      : ""
  }
  </div>
</section>`;
};

const renderKpi = (data: RenderData): string => {
  const { summary, providerDistribution } = data;
  const { byBucket, contribution } = summary;

  const statCards = [
    { label: "Total Issues", value: summary.totalIssues, cls: "" },
    { label: "Completed", value: byBucket.completed, cls: "completed" },
    { label: "Active", value: byBucket.active, cls: "active" },
    { label: "Blocked", value: byBucket.blocked, cls: "blocked" },
  ];

  const mainCards = statCards
    .map(
      (c) =>
        `<div class="kpi-card">
          <div class="kpi-label">${esc(c.label)}</div>
          <div class="kpi-value ${c.cls}">${c.value}</div>
        </div>`,
    )
    .join("");

  const providerCards = providerDistribution
    .filter((p) => p.count > 0)
    .map(
      (p) =>
        `<div class="kpi-card">
          <div class="kpi-label"><span class="badge badge-${p.provider}">${
          esc(providerLabel[p.provider])
        }</span></div>
          <div class="kpi-value">${p.count}</div>
          <div class="kpi-sub">${esc(String(p.count))} issues</div>
        </div>`,
    )
    .join("");

  const contribCard = `<div class="kpi-card">
    <div class="kpi-label">My Comments</div>
    <div class="kpi-value">${contribution.totalUserComments}</div>
    <div class="kpi-sub">${contribution.authoredIssues} authored · ${contribution.assignedIssues} assigned</div>
  </div>`;

  return `
<section class="section">
  <div class="section-header">
    <h2 class="section-title">At a Glance</h2>
  </div>
  <div class="kpi-grid">${mainCards}${providerCards}${contribCard}</div>
</section>`;
};

const renderTimeline = (issues: NormalizedIssue[]): string => {
  const byDate = buildTimeline(issues);

  if (byDate.size === 0) {
    return `
<section class="section">
  <div class="section-header">
    <h2 class="section-title">Activity Timeline</h2>
  </div>
  <div class="empty-state">No comment activity recorded in this period.</div>
</section>`;
  }

  const days = [...byDate.entries()]
    .map(([date, entries]) => {
      const formatted = formatDate(date + "T00:00:00Z");
      const rows = entries
        .map((e) => {
          const timeStr = formatTime(e.timestamp);
          const inner = `
            <span class="badge badge-${e.provider}">${
            esc(providerLabel[e.provider])
          }</span>
            <span class="timeline-entry-key">${esc(e.issueKey)}</span>
            <span class="timeline-entry-title">${esc(e.issueTitle)}</span>
            <span class="timeline-entry-time" data-localtime="${esc(e.timestamp)}" data-localtime-format="time">${esc(timeStr)}</span>`;
          return e.url
            ? `<a href="${
              esc(e.url)
            }" class="timeline-entry" target="_blank" rel="noopener">${inner}</a>`
            : `<div class="timeline-entry">${inner}</div>`;
        })
        .join("");

      return `
<div class="timeline-day">
  <div class="timeline-date">${esc(formatted)}</div>
  <div class="timeline-entries">${rows}</div>
</div>`;
    })
    .join("");

  const totalEntries = [...byDate.values()].reduce((n, e) => n + e.length, 0);

  return `
<section class="section">
  <div class="section-header">
    <h2 class="section-title">Activity Timeline</h2>
    <span class="section-count">${totalEntries} interactions</span>
  </div>
  ${days}
</section>`;
};

const renderIssueCard = (issue: NormalizedIssue): string => {
  const title = issue.url
    ? `<a href="${esc(issue.url)}" target="_blank" rel="noopener">${
      esc(issue.title)
    }</a>`
    : esc(issue.title);

  const labels = issue.labels
    .slice(0, 4)
    .map((l) => `<span class="badge badge-label">${esc(l)}</span>`)
    .join("");

  const flags = [
    issue.isAuthoredByUser
      ? `<span class="flag flag-author">author</span>`
      : "",
    issue.isAssignedToUser
      ? `<span class="flag flag-assignee">assignee</span>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const snippet = issue.descriptionSnippet
    ? `<div class="issue-card-snippet">${esc(issue.descriptionSnippet)}</div>`
    : "";

  return `
<div class="issue-card">
  <div class="issue-card-header">
    <span class="issue-card-key">${esc(issue.key)}</span>
    <span class="issue-card-title">${title}</span>
    <span class="badge badge-${issue.bucket}">${esc(issue.bucket)}</span>
  </div>
  <div class="issue-card-meta">
    <span class="badge badge-${issue.provider}">${
    esc(providerLabel[issue.provider])
  }</span>
    ${labels}
    ${flags}
  </div>
  ${snippet}
  <div class="issue-card-footer">
    <span class="issue-card-comments">💬 ${issue.userCommentCount} / ${issue.commentCount}</span>
    <span class="issue-card-updated">${esc(formatDate(issue.updatedAt))}</span>
  </div>
</div>`;
};

const renderIssuesByProject = (issues: NormalizedIssue[]): string => {
  if (issues.length === 0) {
    return `
<section class="section">
  <div class="section-header">
    <h2 class="section-title">Issues by Project</h2>
  </div>
  <div class="empty-state">No issues found for this period.</div>
</section>`;
  }

  // Group by project
  const groups = new Map<string, NormalizedIssue[]>();
  for (const issue of issues) {
    const key = issue.project || "other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(issue);
  }

  // Sort groups by total issue count desc
  const sorted = [...groups.entries()].sort((a, b) =>
    b[1].length - a[1].length
  );

  const projectSections = sorted
    .map(([project, projectIssues]) => {
      const cards = projectIssues
        .sort((a, b) => {
          const aMs = Date.parse(a.updatedAt) || 0;
          const bMs = Date.parse(b.updatedAt) || 0;
          return bMs - aMs;
        })
        .map(renderIssueCard)
        .join("");

      return `
<div class="project-group">
  <div class="project-name">${
        esc(project)
      } <span class="section-count">(${projectIssues.length})</span></div>
  <div class="issue-grid">${cards}</div>
</div>`;
    })
    .join("");

  return `
<section class="section">
  <div class="section-header">
    <h2 class="section-title">Issues by Project</h2>
    <span class="section-count">${issues.length} total</span>
  </div>
  ${projectSections}
</section>`;
};

const renderFooter = (data: RenderData): string => {
  const { coverage, context } = data;
  const failed = coverage.failedProviders.length
    ? ` · ${
      coverage.failedProviders.map((p) => providerLabel[p]).join(", ")
    } failed`
    : "";

  return `
<footer class="footer">
  <span class="footer-brand">gitlab-issues</span>
  <div class="footer-meta">
    <span>${coverage.connectedProviderCount}/${coverage.totalProviderCount} providers${failed}</span>
    <span>Generated <span data-localtime="${esc(context.generatedAt)}" data-localtime-format="datetime">${esc(formatDateTime(context.generatedAt))}</span></span>
  </div>
</footer>`;
};

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

export const renderHtml = (data: RenderData): string => {
  const { startDate, endDate } = data.context;
  const title = `Activity Report · ${formatDate(startDate)} – ${
    formatDate(endDate)
  }`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <style>${CSS}</style>
</head>
<body>
  <div class="page">
    ${renderHeader(data)}
    ${renderNarrative(data.narrative)}
    ${renderKpi(data)}
    ${renderTimeline(data.normalizedIssues)}
    ${renderIssuesByProject(data.normalizedIssues)}
    ${renderFooter(data)}
  </div>
  <script>
    document.querySelectorAll('[data-localtime]').forEach(function(el) {
      var iso = el.getAttribute('data-localtime');
      var fmt = el.getAttribute('data-localtime-format');
      try {
        var d = new Date(iso);
        if (isNaN(d.getTime())) return;
        if (fmt === 'time') {
          el.textContent = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        } else {
          el.textContent = d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
        }
      } catch (_) {}
    });
  </script>
</body>
</html>`;
};

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

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

const STYLE_BLOCK = `
  :root {
    --bg: #f6f4ef;
    --paper: #fffdfa;
    --ink: #1f2937;
    --muted: #6b7280;
    --line: #ded8cc;
    --blue: #1d4ed8;
    --blue-soft: #dbeafe;
    --green: #047857;
    --green-soft: #d1fae5;
    --amber: #b45309;
    --amber-soft: #fef3c7;
    --other: #4b5563;
    --radius: 12px;
    --shadow: 0 10px 25px rgba(31, 41, 55, 0.07);
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: radial-gradient(circle at top right, #f2eadb 0%, var(--bg) 45%);
    color: var(--ink);
    font: 14px/1.45 "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  }
  .shell {
    max-width: 1180px;
    margin: 0 auto;
    padding: 20px;
  }
  .header {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--paper);
    box-shadow: var(--shadow);
    padding: 16px;
  }
  .header-top {
    display: flex;
    gap: 12px;
    justify-content: space-between;
    align-items: baseline;
    flex-wrap: wrap;
  }
  .title { margin: 0; font-size: 30px; letter-spacing: -0.02em; }
  .meta { color: var(--muted); font-size: 12px; }
  .toolbar {
    margin-top: 12px;
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 8px;
    align-items: center;
  }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; }
  button, select, input {
    border: 1px solid var(--line);
    border-radius: 10px;
    background: #fff;
    color: var(--ink);
    font: inherit;
    padding: 8px 10px;
  }
  button { cursor: pointer; }
  .chip[data-active="true"] {
    background: #f8fafc;
    border-color: #cbd5e1;
    font-weight: 600;
  }
  .button-primary {
    background: #f8fafc;
    border-color: #cbd5e1;
  }
  .tabs {
    display: flex;
    gap: 6px;
    margin: 12px 0;
    flex-wrap: wrap;
  }
  .tab[data-active="true"] {
    background: var(--blue-soft);
    border-color: #93c5fd;
    color: #1e3a8a;
    font-weight: 600;
  }
  [data-tab-panel] { display: none; }
  [data-tab-panel][data-active="true"] { display: block; }
  .panel {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--paper);
    box-shadow: var(--shadow);
    padding: 14px;
    margin-bottom: 12px;
  }
  .section-title {
    margin: 0 0 10px;
    font-size: 17px;
  }
  .kpis {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 8px;
  }
  .kpi {
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 10px;
    background: #fff;
  }
  .kpi p { margin: 0; color: var(--muted); font-size: 12px; }
  .kpi strong { display: block; margin-top: 4px; font-size: 20px; }
  .split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .list { display: grid; gap: 8px; }
  .card {
    border: 1px solid var(--line);
    border-radius: 10px;
    background: #fff;
    padding: 10px;
  }
  .card h4 { margin: 0; font-size: 15px; }
  .row-meta { margin-top: 4px; color: var(--muted); font-size: 12px; }
  .tone-completed { border-left: 4px solid var(--green); }
  .tone-active { border-left: 4px solid var(--blue); }
  .tone-blocked { border-left: 4px solid var(--amber); }
  .tone-other { border-left: 4px solid var(--other); }
  .empty {
    border: 1px dashed var(--line);
    border-radius: 10px;
    padding: 12px;
    color: var(--muted);
    background: #fafaf8;
  }
  .table-toolbar {
    display: grid;
    grid-template-columns: 1.2fr repeat(2, minmax(0, 0.6fr));
    gap: 8px;
    margin-bottom: 8px;
  }
  .table-wrap {
    border: 1px solid var(--line);
    border-radius: 10px;
    overflow: auto;
    background: #fff;
  }
  table { width: 100%; border-collapse: collapse; min-width: 860px; }
  th, td { padding: 10px; border-bottom: 1px solid var(--line); text-align: left; }
  th { color: var(--muted); font-size: 12px; background: #faf8f4; }
  tr[data-row] { cursor: pointer; }
  tr[data-row]:hover { background: #faf8f4; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .sidepanel {
    position: fixed;
    right: 0;
    top: 0;
    width: min(420px, 92vw);
    height: 100vh;
    background: #fff;
    border-left: 1px solid var(--line);
    box-shadow: -8px 0 24px rgba(31, 41, 55, 0.15);
    transform: translateX(100%);
    transition: transform 0.2s ease;
    z-index: 100;
    display: grid;
    grid-template-rows: auto 1fr;
  }
  .sidepanel.open { transform: translateX(0); }
  .sidepanel-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px;
    border-bottom: 1px solid var(--line);
  }
  .sidepanel-body { padding: 10px; overflow: auto; }
  .pill { border-radius: 999px; padding: 2px 8px; font-size: 12px; }
  .pill-completed { background: var(--green-soft); color: #065f46; }
  .pill-active { background: var(--blue-soft); color: #1e3a8a; }
  .pill-blocked { background: var(--amber-soft); color: #92400e; }
  .pill-other { background: #e5e7eb; color: #374151; }
  @media (max-width: 920px) {
    .toolbar { grid-template-columns: 1fr; }
    .split { grid-template-columns: 1fr; }
    .table-toolbar { grid-template-columns: 1fr; }
  }
`;

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
  if (bucket === "completed") return "tone-completed";
  if (bucket === "active") return "tone-active";
  if (bucket === "blocked") return "tone-blocked";
  return "tone-other";
}

function bucketPillClass(bucket: ActivityBucket): string {
  if (bucket === "completed") return "pill pill-completed";
  if (bucket === "active") return "pill pill-active";
  if (bucket === "blocked") return "pill pill-blocked";
  return "pill pill-other";
}

function parseRiskLine(value: string): { context: string; action: string } {
  const match = value.match(/^\[([^\]]+)\]\s*(.+)$/);
  if (!match) return { context: "Follow-up", action: value };
  return { context: match[1], action: match[2] };
}

function buildClientScript() {
  return `
(() => {
  const init = () => {
    const root = document.querySelector('[data-root]');
    if (!root) return;

    const state = {
      tab: 'overview',
      provider: 'all',
      query: '',
      filterState: 'all',
      filterImpact: 'all',
    };

    const bySel = (sel) => Array.from(document.querySelectorAll(sel));

    const applyTabs = (tabId) => {
      state.tab = tabId;
      bySel('[data-tab]').forEach((node) => {
        const active = node.getAttribute('data-tab') === tabId;
        node.setAttribute('data-active', String(active));
        node.setAttribute('aria-selected', String(active));
      });
      bySel('[data-tab-panel]').forEach((node) => {
        const active = node.getAttribute('data-tab-panel') === tabId;
        node.setAttribute('data-active', String(active));
      });
    };

    const applyProvider = (provider) => {
      state.provider = provider;
      bySel('[data-provider-chip]').forEach((chip) => {
        const active = chip.getAttribute('data-provider-chip') === provider;
        chip.setAttribute('data-active', String(active));
      });
      const providerFilter = document.querySelector('[data-filter-provider]');
      if (providerFilter) providerFilter.value = provider;
      renderVisibility();
    };

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

    const renderVisibility = () => {
      bySel('[data-provider-scoped]').forEach((node) => {
        const provider = node.getAttribute('data-provider') || '';
        const visible = state.provider === 'all' || provider === state.provider;
        node.style.display = visible ? '' : 'none';
      });

      bySel('[data-row]').forEach((row) => {
        row.style.display = rowMatchesFilters(row) ? '' : 'none';
      });
    };

    const openSidePanel = (row) => {
      const panel = document.querySelector('[data-sidepanel]');
      if (!panel) return;
      const fields = {
        key: row.getAttribute('data-key') || '-',
        title: row.getAttribute('data-title') || '-',
        provider: row.getAttribute('data-provider-label') || '-',
        state: row.getAttribute('data-state') || '-',
        bucket: row.getAttribute('data-bucket') || '-',
        impact: row.getAttribute('data-impact') || '-',
        updated: row.getAttribute('data-updated') || '-',
        authored: row.getAttribute('data-authored') || '-',
        assigned: row.getAttribute('data-assigned') || '-',
        commented: row.getAttribute('data-commented') || '-',
        comments: row.getAttribute('data-comments') || '0',
        labels: row.getAttribute('data-labels') || 'none',
        url: row.getAttribute('data-url') || '',
      };

      Object.entries(fields).forEach(([key, value]) => {
        const target = panel.querySelector('[data-panel-' + key + ']');
        if (target) target.textContent = String(value);
      });

      const link = panel.querySelector('[data-panel-link]');
      if (link) {
        if (fields.url) {
          link.setAttribute('href', fields.url);
          link.removeAttribute('hidden');
        } else {
          link.setAttribute('hidden', 'hidden');
        }
      }

      panel.classList.add('open');
      panel.setAttribute('aria-hidden', 'false');
      const closeBtn = panel.querySelector('[data-sidepanel-close]');
      if (closeBtn) closeBtn.focus();
    };

    bySel('[data-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        applyTabs(button.getAttribute('data-tab') || 'overview');
      });
    });

    bySel('[data-provider-chip]').forEach((chip) => {
      chip.addEventListener('click', () => {
        applyProvider(chip.getAttribute('data-provider-chip') || 'all');
      });
    });

    const providerFilter = document.querySelector('[data-filter-provider]');
    if (providerFilter) {
      providerFilter.addEventListener('change', (event) => {
        const target = event.target;
        const value = target && target.value ? String(target.value) : 'all';
        applyProvider(value);
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

    bySel('[data-row]').forEach((row) => {
      row.addEventListener('click', () => openSidePanel(row));
      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openSidePanel(row);
        }
      });
    });

    const panel = document.querySelector('[data-sidepanel]');
    if (panel) {
      const closePanel = () => {
        panel.classList.remove('open');
        panel.setAttribute('aria-hidden', 'true');
      };
      const closeBtn = panel.querySelector('[data-sidepanel-close]');
      if (closeBtn) closeBtn.addEventListener('click', closePanel);
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closePanel();
      });
    }

    const exportCsv = document.querySelector('[data-export-csv]');
    if (exportCsv) {
      exportCsv.addEventListener('click', () => {
        const visibleRows = bySel('[data-row]').filter((row) => row.style.display !== 'none');
        const headers = ['Rank','Issue','Provider','State','Bucket','Impact','Updated','Authored','Assigned','Commented'];
        const data = visibleRows.map((row) => [
          row.getAttribute('data-rank') || '',
          row.getAttribute('data-key') || '',
          row.getAttribute('data-provider-label') || '',
          row.getAttribute('data-state') || '',
          row.getAttribute('data-bucket') || '',
          row.getAttribute('data-impact') || '',
          row.getAttribute('data-updated') || '',
          row.getAttribute('data-authored') || '',
          row.getAttribute('data-assigned') || '',
          row.getAttribute('data-commented') || '',
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

    applyTabs('overview');
    applyProvider('all');
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
  const { summary, narrative, context, normalizedIssues, coverage } = payload;
  const windowLabel = `${formatHumanDate(context.startDate)} -> ${formatHumanDate(context.endDate)}`;
  const generatedAt = formatHumanDateTime(context.generatedAt ?? new Date().toISOString());

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Activity Report</title>
        <style dangerouslySetInnerHTML={{ __html: STYLE_BLOCK }} />
      </head>
      <body>
        <main className="shell" data-root="true">
          <header className="header">
            <div className="header-top">
              <div>
                <h1 className="title">Activity Report</h1>
                <div className="meta">Window: {windowLabel} | Generated: {generatedAt}</div>
              </div>
              <div className="meta">Source: {context.sourceMode ?? "report"} | Fetch mode: {context.fetchMode}</div>
            </div>
            <div className="toolbar">
              <div className="chips" aria-label="Provider filters">
                <button type="button" className="chip" data-provider-chip="all" data-active="true">All</button>
                <button type="button" className="chip" data-provider-chip="github">GitHub</button>
                <button type="button" className="chip" data-provider-chip="gitlab">GitLab</button>
                <button type="button" className="chip" data-provider-chip="jira">Jira</button>
              </div>
              <div className="meta">Providers connected: {coverage.connectedProviderCount}/{coverage.totalProviderCount}</div>
              <button type="button" className="button-primary" data-export-csv>Export CSV</button>
            </div>
          </header>

          <nav className="tabs" aria-label="Report tabs">
            <button type="button" className="tab" data-tab="overview" data-active="true" role="tab" aria-selected="true">Overview</button>
            <button type="button" className="tab" data-tab="highlights" role="tab" aria-selected="false">Highlights</button>
            <button type="button" className="tab" data-tab="issues" role="tab" aria-selected="false">Issues</button>
            <button type="button" className="tab" data-tab="appendix" role="tab" aria-selected="false">Appendix</button>
          </nav>

          <section className="panel" data-tab-panel="overview" data-active="true">
            <h2 className="section-title">Executive Summary</h2>
            <p>{narrative.executiveHeadline}</p>
            <div className="meta" style={{ marginBottom: "10px" }}>
              This report shows activity only for the selected current window.
            </div>
            <div className="kpis">
              <article className="kpi"><p>Total Issues</p><strong>{summary.totalIssues}</strong></article>
              <article className="kpi"><p>Completed</p><strong>{summary.byBucket.completed}</strong></article>
              <article className="kpi"><p>Active</p><strong>{summary.byBucket.active}</strong></article>
              <article className="kpi"><p>Blocked</p><strong>{summary.byBucket.blocked}</strong></article>
              <article className="kpi"><p>Contributed Issues</p><strong>{summary.contribution.contributedIssues}</strong></article>
              <article className="kpi"><p>User Comments</p><strong>{summary.contribution.totalUserComments}</strong></article>
              <article className="kpi"><p>High Priority</p><strong>{summary.highPriorityLabelIssues}</strong></article>
              <article className="kpi"><p>GitHub / GitLab / Jira</p><strong>{summary.byProvider.github} / {summary.byProvider.gitlab} / {summary.byProvider.jira}</strong></article>
            </div>
          </section>

          <section className="panel" data-tab-panel="highlights">
            <div className="split">
              <div>
                <h2 className="section-title">Top Highlights</h2>
                <div className="list">
                  {summary.topActivityHighlights.length
                    ? summary.topActivityHighlights.map((issue, index) => {
                      const wording = narrative.topHighlightWording[index] ?? issue.descriptionSnippet;
                      return (
                        <article
                          key={`${issue.provider}-${issue.key}`}
                          className={`card ${bucketToneClass(issue.bucket)}`}
                          data-provider-scoped="true"
                          data-provider={issue.provider}
                        >
                          <h4>{PROVIDER_LABEL[issue.provider]} · {issue.key}</h4>
                          <div>{issue.title}</div>
                          <div className="row-meta">{issue.state} · Updated {formatHumanDateTime(issue.updatedAt)} · Impact {issue.impactScore}</div>
                          <p>{wording}</p>
                        </article>
                      );
                    })
                    : <div className="empty">No highlights selected for this window.</div>}
                </div>
              </div>
              <div>
                <h2 className="section-title">Risks and Follow-ups</h2>
                <div className="list">
                  {narrative.risksAndFollowUps.length
                    ? narrative.risksAndFollowUps.map((line, index) => {
                      const parsed = parseRiskLine(line);
                      const sourceIssue = summary.risksAndFollowUps[index];
                      return (
                        <article
                          key={`${line}-${index}`}
                          className="card tone-blocked"
                          data-provider-scoped="true"
                          data-provider={sourceIssue?.provider ?? "github"}
                        >
                          <h4>{parsed.context}</h4>
                          <p>{parsed.action}</p>
                        </article>
                      );
                    })
                    : <div className="empty">No immediate follow-up actions required.</div>}
                </div>
              </div>
            </div>
          </section>

          <section className="panel" data-tab-panel="issues">
            <h2 className="section-title">Collaboration</h2>
            <div className="list" style={{ marginBottom: "10px" }}>
              {summary.collaborationHighlights.length
                ? summary.collaborationHighlights.map((issue) => (
                  <article
                    key={`${issue.provider}-${issue.key}`}
                    className={`card ${bucketToneClass(issue.bucket)}`}
                    data-provider-scoped="true"
                    data-provider={issue.provider}
                  >
                    <h4>{PROVIDER_LABEL[issue.provider]} · {issue.key}</h4>
                    <div>{issue.title}</div>
                    <div className="row-meta">Comments by user: {issue.userCommentCount} · Impact {issue.impactScore}</div>
                  </article>
                ))
                : <div className="empty">No collaboration highlights for this window.</div>}
            </div>

            <h2 className="section-title">Talking Points</h2>
            <div className="list">
              {narrative.weeklyTalkingPoints.length
                ? narrative.weeklyTalkingPoints.slice(0, 5).map((point, index) => (
                  <article key={`${point.lead}-${index}`} className="card tone-active">
                    <h4>{point.lead}</h4>
                    <ul>
                      {point.bullets.slice(0, 5).map((bullet, bulletIndex) => (
                        <li key={`${bullet}-${bulletIndex}`}>{bullet}</li>
                      ))}
                    </ul>
                  </article>
                ))
                : <div className="empty">No talking points generated.</div>}
            </div>
          </section>

          <section className="panel" data-tab-panel="appendix">
            <h2 className="section-title">Appendix</h2>
            <div className="table-toolbar">
              <input className="control" data-search placeholder="Search issue or title" />
              <select className="control" data-filter-provider>
                <option value="all">Provider: All</option>
                <option value="github">GitHub</option>
                <option value="gitlab">GitLab</option>
                <option value="jira">Jira</option>
              </select>
              <select className="control" data-filter-state>
                <option value="all">State: Any</option>
                <option value="open">Open</option>
                <option value="closed">Closed/Done</option>
                <option value="blocked">Blocked</option>
              </select>
              <select className="control" data-filter-impact>
                <option value="all">Impact: Any</option>
                <option value="high">High (80+)</option>
                <option value="medium">Medium (50-79)</option>
                <option value="low">Low (&lt;50)</option>
              </select>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Issue</th>
                    <th>Provider</th>
                    <th>State</th>
                    <th>Bucket</th>
                    <th>Impact</th>
                    <th>Updated</th>
                    <th>Authored</th>
                    <th>Assigned</th>
                    <th>Commented</th>
                  </tr>
                </thead>
                <tbody>
                  {normalizedIssues.length
                    ? normalizedIssues.map((issue, index) => (
                      <tr
                        key={`${issue.provider}-${issue.key}-${index}`}
                        tabIndex={0}
                        data-row
                        data-rank={index + 1}
                        data-provider={issue.provider}
                        data-provider-label={PROVIDER_LABEL[issue.provider]}
                        data-key={issue.key}
                        data-title={issue.title}
                        data-state={issue.state}
                        data-bucket={issue.bucket}
                        data-impact={issue.impactScore}
                        data-updated={formatHumanDateTime(issue.updatedAt)}
                        data-authored={issue.isAuthoredByUser ? "yes" : "no"}
                        data-assigned={issue.isAssignedToUser ? "yes" : "no"}
                        data-commented={issue.isCommentedByUser ? "yes" : "no"}
                        data-comments={issue.userCommentCount}
                        data-labels={(issue.labels ?? []).join(", ") || "none"}
                        data-url={issue.url ?? ""}
                      >
                        <td className="mono">{index + 1}</td>
                        <td>{issue.url ? <a href={issue.url}>{issue.key}</a> : issue.key}</td>
                        <td>{PROVIDER_LABEL[issue.provider]}</td>
                        <td>{issue.state}</td>
                        <td><span className={bucketPillClass(issue.bucket)}>{BUCKET_LABEL[issue.bucket]}</span></td>
                        <td className="mono">{issue.impactScore}</td>
                        <td>{formatHumanDateTime(issue.updatedAt)}</td>
                        <td className="mono">{issue.isAuthoredByUser ? "yes" : "no"}</td>
                        <td className="mono">{issue.isAssignedToUser ? "yes" : "no"}</td>
                        <td className="mono">{issue.isCommentedByUser ? "yes" : "no"}</td>
                      </tr>
                    ))
                    : (
                      <tr>
                        <td colSpan={10}>
                          <div className="empty">No issues available for this window.</div>
                        </td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="sidepanel" data-sidepanel aria-hidden="true">
            <div className="sidepanel-head">
              <strong>Issue Details</strong>
              <button type="button" data-sidepanel-close>Close</button>
            </div>
            <div className="sidepanel-body">
              <p><strong className="mono" data-panel-key>-</strong> <span data-panel-title>-</span></p>
              <p><span className="meta">Provider</span><br /><span data-panel-provider>-</span></p>
              <p><span className="meta">State</span><br /><span data-panel-state>-</span></p>
              <p><span className="meta">Bucket</span><br /><span data-panel-bucket>-</span></p>
              <p><span className="meta">Impact</span><br /><span className="mono" data-panel-impact>-</span></p>
              <p><span className="meta">Updated</span><br /><span data-panel-updated>-</span></p>
              <p><span className="meta">Authored / Assigned / Commented</span><br /><span data-panel-authored>-</span> / <span data-panel-assigned>-</span> / <span data-panel-commented>-</span></p>
              <p><span className="meta">User comments</span><br /><span className="mono" data-panel-comments>-</span></p>
              <p><span className="meta">Labels</span><br /><span data-panel-labels>-</span></p>
              <p><a data-panel-link target="_blank" rel="noreferrer">Open issue</a></p>
            </div>
          </aside>
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
  const html = "<!doctype html>" + renderToStaticMarkup(<ReportDocument payload={payload} />);
  process.stdout.write(html);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`shadcn renderer failed: ${message}\n`);
  process.exit(1);
});

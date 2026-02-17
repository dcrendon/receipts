import { jsx, jsxs } from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
const PROVIDER_LABEL = {
  github: "GitHub",
  gitlab: "GitLab",
  jira: "Jira"
};
const BUCKET_LABEL = {
  completed: "Completed",
  active: "Active",
  blocked: "Blocked",
  other: "Other"
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
function formatHumanDateTime(value) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short"
  }).format(new Date(parsed));
}
function formatHumanDate(value) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(parsed));
}
function bucketToneClass(bucket) {
  if (bucket === "completed") return "tone-completed";
  if (bucket === "active") return "tone-active";
  if (bucket === "blocked") return "tone-blocked";
  return "tone-other";
}
function bucketPillClass(bucket) {
  if (bucket === "completed") return "pill pill-completed";
  if (bucket === "active") return "pill pill-active";
  if (bucket === "blocked") return "pill pill-blocked";
  return "pill pill-other";
}
function parseRiskLine(value) {
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
function ReportDocument({ payload }) {
  const { summary, narrative, context, normalizedIssues, coverage } = payload;
  const windowLabel = `${formatHumanDate(context.startDate)} -> ${formatHumanDate(context.endDate)}`;
  const generatedAt = formatHumanDateTime(context.generatedAt ?? (/* @__PURE__ */ new Date()).toISOString());
  return /* @__PURE__ */ jsxs("html", { lang: "en", children: [
    /* @__PURE__ */ jsxs("head", { children: [
      /* @__PURE__ */ jsx("meta", { charSet: "utf-8" }),
      /* @__PURE__ */ jsx("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }),
      /* @__PURE__ */ jsx("title", { children: "Activity Report" }),
      /* @__PURE__ */ jsx("style", { dangerouslySetInnerHTML: { __html: STYLE_BLOCK } })
    ] }),
    /* @__PURE__ */ jsxs("body", { children: [
      /* @__PURE__ */ jsxs("main", { className: "shell", "data-root": "true", children: [
        /* @__PURE__ */ jsxs("header", { className: "header", children: [
          /* @__PURE__ */ jsxs("div", { className: "header-top", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("h1", { className: "title", children: "Activity Report" }),
              /* @__PURE__ */ jsxs("div", { className: "meta", children: [
                "Window: ",
                windowLabel,
                " | Generated: ",
                generatedAt
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "meta", children: [
              "Source: ",
              context.sourceMode ?? "report",
              " | Fetch mode: ",
              context.fetchMode
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "toolbar", children: [
            /* @__PURE__ */ jsxs("div", { className: "chips", "aria-label": "Provider filters", children: [
              /* @__PURE__ */ jsx("button", { type: "button", className: "chip", "data-provider-chip": "all", "data-active": "true", children: "All" }),
              /* @__PURE__ */ jsx("button", { type: "button", className: "chip", "data-provider-chip": "github", children: "GitHub" }),
              /* @__PURE__ */ jsx("button", { type: "button", className: "chip", "data-provider-chip": "gitlab", children: "GitLab" }),
              /* @__PURE__ */ jsx("button", { type: "button", className: "chip", "data-provider-chip": "jira", children: "Jira" })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "meta", children: [
              "Providers connected: ",
              coverage.connectedProviderCount,
              "/",
              coverage.totalProviderCount
            ] }),
            /* @__PURE__ */ jsx("button", { type: "button", className: "button-primary", "data-export-csv": true, children: "Export CSV" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("nav", { className: "tabs", "aria-label": "Report tabs", children: [
          /* @__PURE__ */ jsx("button", { type: "button", className: "tab", "data-tab": "overview", "data-active": "true", role: "tab", "aria-selected": "true", children: "Overview" }),
          /* @__PURE__ */ jsx("button", { type: "button", className: "tab", "data-tab": "highlights", role: "tab", "aria-selected": "false", children: "Highlights" }),
          /* @__PURE__ */ jsx("button", { type: "button", className: "tab", "data-tab": "issues", role: "tab", "aria-selected": "false", children: "Issues" }),
          /* @__PURE__ */ jsx("button", { type: "button", className: "tab", "data-tab": "appendix", role: "tab", "aria-selected": "false", children: "Appendix" })
        ] }),
        /* @__PURE__ */ jsxs("section", { className: "panel", "data-tab-panel": "overview", "data-active": "true", children: [
          /* @__PURE__ */ jsx("h2", { className: "section-title", children: "Executive Summary" }),
          /* @__PURE__ */ jsx("p", { children: narrative.executiveHeadline }),
          /* @__PURE__ */ jsx("div", { className: "meta", style: { marginBottom: "10px" }, children: "This report shows activity only for the selected current window." }),
          /* @__PURE__ */ jsxs("div", { className: "kpis", children: [
            /* @__PURE__ */ jsxs("article", { className: "kpi", children: [
              /* @__PURE__ */ jsx("p", { children: "Total Issues" }),
              /* @__PURE__ */ jsx("strong", { children: summary.totalIssues })
            ] }),
            /* @__PURE__ */ jsxs("article", { className: "kpi", children: [
              /* @__PURE__ */ jsx("p", { children: "Completed" }),
              /* @__PURE__ */ jsx("strong", { children: summary.byBucket.completed })
            ] }),
            /* @__PURE__ */ jsxs("article", { className: "kpi", children: [
              /* @__PURE__ */ jsx("p", { children: "Active" }),
              /* @__PURE__ */ jsx("strong", { children: summary.byBucket.active })
            ] }),
            /* @__PURE__ */ jsxs("article", { className: "kpi", children: [
              /* @__PURE__ */ jsx("p", { children: "Blocked" }),
              /* @__PURE__ */ jsx("strong", { children: summary.byBucket.blocked })
            ] }),
            /* @__PURE__ */ jsxs("article", { className: "kpi", children: [
              /* @__PURE__ */ jsx("p", { children: "Contributed Issues" }),
              /* @__PURE__ */ jsx("strong", { children: summary.contribution.contributedIssues })
            ] }),
            /* @__PURE__ */ jsxs("article", { className: "kpi", children: [
              /* @__PURE__ */ jsx("p", { children: "User Comments" }),
              /* @__PURE__ */ jsx("strong", { children: summary.contribution.totalUserComments })
            ] }),
            /* @__PURE__ */ jsxs("article", { className: "kpi", children: [
              /* @__PURE__ */ jsx("p", { children: "High Priority" }),
              /* @__PURE__ */ jsx("strong", { children: summary.highPriorityLabelIssues })
            ] }),
            /* @__PURE__ */ jsxs("article", { className: "kpi", children: [
              /* @__PURE__ */ jsx("p", { children: "GitHub / GitLab / Jira" }),
              /* @__PURE__ */ jsxs("strong", { children: [
                summary.byProvider.github,
                " / ",
                summary.byProvider.gitlab,
                " / ",
                summary.byProvider.jira
              ] })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsx("section", { className: "panel", "data-tab-panel": "highlights", children: /* @__PURE__ */ jsxs("div", { className: "split", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h2", { className: "section-title", children: "Top Highlights" }),
            /* @__PURE__ */ jsx("div", { className: "list", children: summary.topActivityHighlights.length ? summary.topActivityHighlights.map((issue, index) => {
              const wording = narrative.topHighlightWording[index] ?? issue.descriptionSnippet;
              return /* @__PURE__ */ jsxs(
                "article",
                {
                  className: `card ${bucketToneClass(issue.bucket)}`,
                  "data-provider-scoped": "true",
                  "data-provider": issue.provider,
                  children: [
                    /* @__PURE__ */ jsxs("h4", { children: [
                      PROVIDER_LABEL[issue.provider],
                      " · ",
                      issue.key
                    ] }),
                    /* @__PURE__ */ jsx("div", { children: issue.title }),
                    /* @__PURE__ */ jsxs("div", { className: "row-meta", children: [
                      issue.state,
                      " · Updated ",
                      formatHumanDateTime(issue.updatedAt),
                      " · Impact ",
                      issue.impactScore
                    ] }),
                    /* @__PURE__ */ jsx("p", { children: wording })
                  ]
                },
                `${issue.provider}-${issue.key}`
              );
            }) : /* @__PURE__ */ jsx("div", { className: "empty", children: "No highlights selected for this window." }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h2", { className: "section-title", children: "Risks and Follow-ups" }),
            /* @__PURE__ */ jsx("div", { className: "list", children: narrative.risksAndFollowUps.length ? narrative.risksAndFollowUps.map((line, index) => {
              const parsed = parseRiskLine(line);
              const sourceIssue = summary.risksAndFollowUps[index];
              return /* @__PURE__ */ jsxs(
                "article",
                {
                  className: "card tone-blocked",
                  "data-provider-scoped": "true",
                  "data-provider": sourceIssue?.provider ?? "github",
                  children: [
                    /* @__PURE__ */ jsx("h4", { children: parsed.context }),
                    /* @__PURE__ */ jsx("p", { children: parsed.action })
                  ]
                },
                `${line}-${index}`
              );
            }) : /* @__PURE__ */ jsx("div", { className: "empty", children: "No immediate follow-up actions required." }) })
          ] })
        ] }) }),
        /* @__PURE__ */ jsxs("section", { className: "panel", "data-tab-panel": "issues", children: [
          /* @__PURE__ */ jsx("h2", { className: "section-title", children: "Collaboration" }),
          /* @__PURE__ */ jsx("div", { className: "list", style: { marginBottom: "10px" }, children: summary.collaborationHighlights.length ? summary.collaborationHighlights.map((issue) => /* @__PURE__ */ jsxs(
            "article",
            {
              className: `card ${bucketToneClass(issue.bucket)}`,
              "data-provider-scoped": "true",
              "data-provider": issue.provider,
              children: [
                /* @__PURE__ */ jsxs("h4", { children: [
                  PROVIDER_LABEL[issue.provider],
                  " · ",
                  issue.key
                ] }),
                /* @__PURE__ */ jsx("div", { children: issue.title }),
                /* @__PURE__ */ jsxs("div", { className: "row-meta", children: [
                  "Comments by user: ",
                  issue.userCommentCount,
                  " · Impact ",
                  issue.impactScore
                ] })
              ]
            },
            `${issue.provider}-${issue.key}`
          )) : /* @__PURE__ */ jsx("div", { className: "empty", children: "No collaboration highlights for this window." }) }),
          /* @__PURE__ */ jsx("h2", { className: "section-title", children: "Talking Points" }),
          /* @__PURE__ */ jsx("div", { className: "list", children: narrative.weeklyTalkingPoints.length ? narrative.weeklyTalkingPoints.slice(0, 5).map((point, index) => /* @__PURE__ */ jsxs("article", { className: "card tone-active", children: [
            /* @__PURE__ */ jsx("h4", { children: point.lead }),
            /* @__PURE__ */ jsx("ul", { children: point.bullets.slice(0, 5).map((bullet, bulletIndex) => /* @__PURE__ */ jsx("li", { children: bullet }, `${bullet}-${bulletIndex}`)) })
          ] }, `${point.lead}-${index}`)) : /* @__PURE__ */ jsx("div", { className: "empty", children: "No talking points generated." }) })
        ] }),
        /* @__PURE__ */ jsxs("section", { className: "panel", "data-tab-panel": "appendix", children: [
          /* @__PURE__ */ jsx("h2", { className: "section-title", children: "Appendix" }),
          /* @__PURE__ */ jsxs("div", { className: "table-toolbar", children: [
            /* @__PURE__ */ jsx("input", { className: "control", "data-search": true, placeholder: "Search issue or title" }),
            /* @__PURE__ */ jsxs("select", { className: "control", "data-filter-provider": true, children: [
              /* @__PURE__ */ jsx("option", { value: "all", children: "Provider: All" }),
              /* @__PURE__ */ jsx("option", { value: "github", children: "GitHub" }),
              /* @__PURE__ */ jsx("option", { value: "gitlab", children: "GitLab" }),
              /* @__PURE__ */ jsx("option", { value: "jira", children: "Jira" })
            ] }),
            /* @__PURE__ */ jsxs("select", { className: "control", "data-filter-state": true, children: [
              /* @__PURE__ */ jsx("option", { value: "all", children: "State: Any" }),
              /* @__PURE__ */ jsx("option", { value: "open", children: "Open" }),
              /* @__PURE__ */ jsx("option", { value: "closed", children: "Closed/Done" }),
              /* @__PURE__ */ jsx("option", { value: "blocked", children: "Blocked" })
            ] }),
            /* @__PURE__ */ jsxs("select", { className: "control", "data-filter-impact": true, children: [
              /* @__PURE__ */ jsx("option", { value: "all", children: "Impact: Any" }),
              /* @__PURE__ */ jsx("option", { value: "high", children: "High (80+)" }),
              /* @__PURE__ */ jsx("option", { value: "medium", children: "Medium (50-79)" }),
              /* @__PURE__ */ jsx("option", { value: "low", children: "Low (<50)" })
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { children: [
            /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("th", { children: "Rank" }),
              /* @__PURE__ */ jsx("th", { children: "Issue" }),
              /* @__PURE__ */ jsx("th", { children: "Provider" }),
              /* @__PURE__ */ jsx("th", { children: "State" }),
              /* @__PURE__ */ jsx("th", { children: "Bucket" }),
              /* @__PURE__ */ jsx("th", { children: "Impact" }),
              /* @__PURE__ */ jsx("th", { children: "Updated" }),
              /* @__PURE__ */ jsx("th", { children: "Authored" }),
              /* @__PURE__ */ jsx("th", { children: "Assigned" }),
              /* @__PURE__ */ jsx("th", { children: "Commented" })
            ] }) }),
            /* @__PURE__ */ jsx("tbody", { children: normalizedIssues.length ? normalizedIssues.map((issue, index) => /* @__PURE__ */ jsxs(
              "tr",
              {
                tabIndex: 0,
                "data-row": true,
                "data-rank": index + 1,
                "data-provider": issue.provider,
                "data-provider-label": PROVIDER_LABEL[issue.provider],
                "data-key": issue.key,
                "data-title": issue.title,
                "data-state": issue.state,
                "data-bucket": issue.bucket,
                "data-impact": issue.impactScore,
                "data-updated": formatHumanDateTime(issue.updatedAt),
                "data-authored": issue.isAuthoredByUser ? "yes" : "no",
                "data-assigned": issue.isAssignedToUser ? "yes" : "no",
                "data-commented": issue.isCommentedByUser ? "yes" : "no",
                "data-comments": issue.userCommentCount,
                "data-labels": (issue.labels ?? []).join(", ") || "none",
                "data-url": issue.url ?? "",
                children: [
                  /* @__PURE__ */ jsx("td", { className: "mono", children: index + 1 }),
                  /* @__PURE__ */ jsx("td", { children: issue.url ? /* @__PURE__ */ jsx("a", { href: issue.url, children: issue.key }) : issue.key }),
                  /* @__PURE__ */ jsx("td", { children: PROVIDER_LABEL[issue.provider] }),
                  /* @__PURE__ */ jsx("td", { children: issue.state }),
                  /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: bucketPillClass(issue.bucket), children: BUCKET_LABEL[issue.bucket] }) }),
                  /* @__PURE__ */ jsx("td", { className: "mono", children: issue.impactScore }),
                  /* @__PURE__ */ jsx("td", { children: formatHumanDateTime(issue.updatedAt) }),
                  /* @__PURE__ */ jsx("td", { className: "mono", children: issue.isAuthoredByUser ? "yes" : "no" }),
                  /* @__PURE__ */ jsx("td", { className: "mono", children: issue.isAssignedToUser ? "yes" : "no" }),
                  /* @__PURE__ */ jsx("td", { className: "mono", children: issue.isCommentedByUser ? "yes" : "no" })
                ]
              },
              `${issue.provider}-${issue.key}-${index}`
            )) : /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", { colSpan: 10, children: /* @__PURE__ */ jsx("div", { className: "empty", children: "No issues available for this window." }) }) }) })
          ] }) })
        ] }),
        /* @__PURE__ */ jsxs("aside", { className: "sidepanel", "data-sidepanel": true, "aria-hidden": "true", children: [
          /* @__PURE__ */ jsxs("div", { className: "sidepanel-head", children: [
            /* @__PURE__ */ jsx("strong", { children: "Issue Details" }),
            /* @__PURE__ */ jsx("button", { type: "button", "data-sidepanel-close": true, children: "Close" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "sidepanel-body", children: [
            /* @__PURE__ */ jsxs("p", { children: [
              /* @__PURE__ */ jsx("strong", { className: "mono", "data-panel-key": true, children: "-" }),
              " ",
              /* @__PURE__ */ jsx("span", { "data-panel-title": true, children: "-" })
            ] }),
            /* @__PURE__ */ jsxs("p", { children: [
              /* @__PURE__ */ jsx("span", { className: "meta", children: "Provider" }),
              /* @__PURE__ */ jsx("br", {}),
              /* @__PURE__ */ jsx("span", { "data-panel-provider": true, children: "-" })
            ] }),
            /* @__PURE__ */ jsxs("p", { children: [
              /* @__PURE__ */ jsx("span", { className: "meta", children: "State" }),
              /* @__PURE__ */ jsx("br", {}),
              /* @__PURE__ */ jsx("span", { "data-panel-state": true, children: "-" })
            ] }),
            /* @__PURE__ */ jsxs("p", { children: [
              /* @__PURE__ */ jsx("span", { className: "meta", children: "Bucket" }),
              /* @__PURE__ */ jsx("br", {}),
              /* @__PURE__ */ jsx("span", { "data-panel-bucket": true, children: "-" })
            ] }),
            /* @__PURE__ */ jsxs("p", { children: [
              /* @__PURE__ */ jsx("span", { className: "meta", children: "Impact" }),
              /* @__PURE__ */ jsx("br", {}),
              /* @__PURE__ */ jsx("span", { className: "mono", "data-panel-impact": true, children: "-" })
            ] }),
            /* @__PURE__ */ jsxs("p", { children: [
              /* @__PURE__ */ jsx("span", { className: "meta", children: "Updated" }),
              /* @__PURE__ */ jsx("br", {}),
              /* @__PURE__ */ jsx("span", { "data-panel-updated": true, children: "-" })
            ] }),
            /* @__PURE__ */ jsxs("p", { children: [
              /* @__PURE__ */ jsx("span", { className: "meta", children: "Authored / Assigned / Commented" }),
              /* @__PURE__ */ jsx("br", {}),
              /* @__PURE__ */ jsx("span", { "data-panel-authored": true, children: "-" }),
              " / ",
              /* @__PURE__ */ jsx("span", { "data-panel-assigned": true, children: "-" }),
              " / ",
              /* @__PURE__ */ jsx("span", { "data-panel-commented": true, children: "-" })
            ] }),
            /* @__PURE__ */ jsxs("p", { children: [
              /* @__PURE__ */ jsx("span", { className: "meta", children: "User comments" }),
              /* @__PURE__ */ jsx("br", {}),
              /* @__PURE__ */ jsx("span", { className: "mono", "data-panel-comments": true, children: "-" })
            ] }),
            /* @__PURE__ */ jsxs("p", { children: [
              /* @__PURE__ */ jsx("span", { className: "meta", children: "Labels" }),
              /* @__PURE__ */ jsx("br", {}),
              /* @__PURE__ */ jsx("span", { "data-panel-labels": true, children: "-" })
            ] }),
            /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("a", { "data-panel-link": true, target: "_blank", rel: "noreferrer", children: "Open issue" }) })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx("script", { dangerouslySetInnerHTML: { __html: buildClientScript() } })
    ] })
  ] });
}
function readStdin() {
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
  const payload = JSON.parse(rawInput);
  const html = "<!doctype html>" + renderToStaticMarkup(/* @__PURE__ */ jsx(ReportDocument, { payload }));
  process.stdout.write(html);
}
main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`shadcn renderer failed: ${message}
`);
  process.exit(1);
});

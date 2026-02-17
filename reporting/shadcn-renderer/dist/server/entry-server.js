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
    --bg: #f5f7fa;
    --surface: #ffffff;
    --surface-muted: #f9fbfd;
    --text: #0f172a;
    --text-muted: #475569;
    --border: #dbe3ed;
    --shadow: 0 8px 30px rgba(15, 23, 42, 0.06);
    --radius: 12px;
    --space-4: 4px;
    --space-8: 8px;
    --space-12: 12px;
    --space-16: 16px;
    --space-24: 24px;
    --space-32: 32px;
    --completed: #0f766e;
    --active: #1d4ed8;
    --blocked: #b45309;
    --other: #64748b;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: "Manrope", "Segoe UI", sans-serif;
    font-size: 14px;
    line-height: 1.45;
  }
  .shell {
    max-width: 1240px;
    margin: 0 auto;
    padding: var(--space-24);
  }
  .header {
    position: sticky;
    top: 0;
    z-index: 20;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: rgba(255, 255, 255, 0.96);
    backdrop-filter: blur(6px);
    box-shadow: var(--shadow);
    padding: var(--space-12);
    margin-bottom: var(--space-16);
  }
  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-12);
    flex-wrap: wrap;
  }
  .title {
    margin: 0;
    font-size: 30px;
    line-height: 1.1;
    letter-spacing: -0.02em;
  }
  .meta {
    color: var(--text-muted);
    font-size: 12px;
  }
  .header-controls {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: var(--space-8);
    margin-top: var(--space-12);
  }
  .control,
  .button,
  .chip,
  .tab {
    border: 1px solid var(--border);
    background: var(--surface);
    border-radius: 10px;
    padding: 8px 10px;
    font: inherit;
    color: var(--text);
  }
  .control { width: 100%; }
  .button { cursor: pointer; }
  .button.primary { background: #e9f1ff; border-color: #bfdbfe; }
  .button.ghost { background: #fff; }
  .chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .chip {
    cursor: pointer;
    font-size: 12px;
  }
  .chip[data-active="true"] {
    background: #eff6ff;
    border-color: #93c5fd;
    color: #1e3a8a;
  }
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: var(--space-12) 0;
  }
  .tab[data-active="true"] {
    background: #f1f5f9;
    border-color: #cbd5e1;
    font-weight: 600;
  }
  [data-tab-panel] { display: none; }
  [data-tab-panel][data-active="true"] { display: block; }
  .panel {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow);
    padding: var(--space-16);
    margin-bottom: var(--space-16);
  }
  .hero { background: linear-gradient(180deg, #ffffff, #f8fbff); }
  .hero-grid {
    display: grid;
    grid-template-columns: 1.45fr 1fr;
    gap: var(--space-16);
  }
  .headline {
    margin: var(--space-8) 0 0;
    font-size: 15px;
  }
  .delta-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-8);
    margin-top: var(--space-12);
  }
  .delta {
    background: var(--surface-muted);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: var(--space-8);
  }
  .delta-label {
    font-size: 12px;
    color: var(--text-muted);
    margin: 0;
  }
  .delta-value {
    margin: var(--space-4) 0 0;
    font-family: "JetBrains Mono", monospace;
    font-size: 18px;
  }
  .delta-change { font-size: 12px; font-family: "JetBrains Mono", monospace; }
  .delta-up { color: #166534; }
  .delta-down { color: #991b1b; }
  .delta-flat { color: var(--text-muted); }
  .kpi-strip {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-8);
  }
  .stat { border: 1px solid var(--border); border-radius: 10px; padding: var(--space-8); background: var(--surface-muted); }
  .stat p { margin: 0; font-size: 12px; color: var(--text-muted); }
  .stat strong { display: block; margin-top: var(--space-4); font-family: "JetBrains Mono", monospace; font-size: 20px; }
  details.more-kpis { margin-top: var(--space-8); }
  .section-title {
    margin: 0 0 var(--space-12);
    font-size: 17px;
    line-height: 1.3;
  }
  .split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-12);
  }
  .issue-list {
    display: grid;
    gap: var(--space-8);
  }
  .issue-row {
    border: 1px solid var(--border);
    border-left: 4px solid var(--active);
    border-radius: 10px;
    padding: var(--space-12);
    background: #fff;
  }
  .issue-row.tone-completed { border-left-color: var(--completed); }
  .issue-row.tone-active { border-left-color: var(--active); }
  .issue-row.tone-blocked { border-left-color: var(--blocked); }
  .issue-row.tone-other { border-left-color: var(--other); }
  .issue-head {
    display: flex;
    justify-content: space-between;
    gap: var(--space-8);
    align-items: flex-start;
  }
  .issue-key {
    font-family: "JetBrains Mono", monospace;
    font-size: 12px;
  }
  .badge {
    border-radius: 999px;
    border: 1px solid var(--border);
    padding: 2px 8px;
    font-size: 12px;
    background: var(--surface-muted);
  }
  .empty {
    border: 1px dashed var(--border);
    border-radius: 10px;
    background: var(--surface-muted);
    padding: var(--space-12);
    color: var(--text-muted);
    font-size: 13px;
  }
  .collab-grid {
    display: grid;
    grid-template-columns: minmax(220px, 320px) 1fr;
    gap: var(--space-12);
    align-items: start;
  }
  .collab-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .collab-item { display: flex; align-items: center; gap: 8px; border: 1px solid var(--border); border-radius: 10px; padding: 8px; }
  .avatar {
    width: 28px;
    height: 28px;
    border-radius: 999px;
    background: #e2e8f0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
  }
  .table-toolbar {
    display: grid;
    grid-template-columns: 1.1fr repeat(3, minmax(0, 0.5fr)) auto;
    gap: var(--space-8);
    margin-bottom: var(--space-8);
  }
  .table-wrap {
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: auto;
    background: #fff;
  }
  table { width: 100%; border-collapse: collapse; min-width: 780px; }
  th, td { padding: 10px; border-bottom: 1px solid var(--border); text-align: left; }
  th { font-size: 12px; color: var(--text-muted); background: var(--surface-muted); }
  tr[data-row] { cursor: pointer; }
  tr[data-row]:hover { background: #f8fafc; }
  .col-optional { display: none; }
  [data-show-optional="true"] .col-optional { display: table-cell; }
  .sidepanel {
    position: fixed;
    top: 0;
    right: 0;
    width: min(440px, 92vw);
    height: 100vh;
    background: #fff;
    box-shadow: -8px 0 28px rgba(15, 23, 42, 0.18);
    border-left: 1px solid var(--border);
    transform: translateX(100%);
    transition: transform 0.22s ease;
    z-index: 40;
    display: grid;
    grid-template-rows: auto 1fr;
  }
  .sidepanel.open { transform: translateX(0); }
  .sidepanel-head { padding: var(--space-12); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; }
  .sidepanel-body { padding: var(--space-12); overflow: auto; }
  .mono { font-family: "JetBrains Mono", monospace; }
  .impact-info {
    margin-left: 6px;
    font-size: 12px;
    color: #1d4ed8;
    text-decoration: underline;
    cursor: pointer;
  }
  .popover {
    display: none;
    position: absolute;
    margin-top: 4px;
    max-width: 320px;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px;
    box-shadow: var(--shadow);
    font-size: 12px;
    z-index: 30;
  }
  .popover.open { display: block; }
  .donut {
    width: 110px;
    height: 110px;
    border-radius: 999px;
    margin: 0 auto;
    position: relative;
    background: var(--donut-gradient, conic-gradient(#1d4ed8 0deg, #1d4ed8 120deg, #0f766e 120deg, #0f766e 210deg, #b45309 210deg, #b45309 360deg));
  }
  .donut::after {
    content: "";
    position: absolute;
    inset: 22px;
    background: #fff;
    border-radius: 999px;
  }
  .state-bars { display: grid; gap: 8px; margin-top: 10px; }
  .bar { height: 10px; border-radius: 999px; background: #e2e8f0; overflow: hidden; }
  .bar > span { display: block; height: 100%; }
  .bar-completed > span { background: var(--completed); }
  .bar-active > span { background: var(--active); }
  .bar-blocked > span { background: var(--blocked); }
  .trend {
    margin-top: 12px;
    border: 1px dashed var(--border);
    border-radius: 10px;
    padding: 10px;
    color: var(--text-muted);
    font-size: 12px;
  }
  dialog {
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 0;
    width: min(640px, 94vw);
  }
  dialog::backdrop { background: rgba(15, 23, 42, 0.35); }
  .modal-head { padding: 12px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; }
  .modal-body { padding: 12px; }
  .profile-brief [data-density="dense-hide-brief"],
  .profile-activity_retro [data-density="dense-hide-activity_retro"],
  .profile-showcase [data-density="dense-hide-showcase"] {
    display: none !important;
  }
  @media (max-width: 980px) {
    .hero-grid, .split, .collab-grid { grid-template-columns: 1fr; }
    .table-toolbar { grid-template-columns: 1fr 1fr; }
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
function deltaTone(delta) {
  if (delta > 0) return "delta-up";
  if (delta < 0) return "delta-down";
  return "delta-flat";
}
function bucketToneClass(bucket) {
  if (bucket === "completed") return "tone-completed";
  if (bucket === "active") return "tone-active";
  if (bucket === "blocked") return "tone-blocked";
  return "tone-other";
}
function parseRiskLine(value) {
  const match = value.match(/^\[([^\]]+)\]\s*(.+)$/);
  if (!match) {
    return { context: "Follow-up", action: value };
  }
  return { context: match[1], action: match[2] };
}
function buildClientScript() {
  return `
(() => {
  const root = document.querySelector('[data-root]');
  if (!root) return;
  const state = {
    provider: 'all',
    query: '',
    filterState: 'all',
    filterImpact: 'all',
    showOptionalCols: false,
    profile: root.getAttribute('data-profile') || 'activity_retro',
  };

  const providers = new Set(['github', 'gitlab', 'jira']);

  const bySel = (sel) => Array.from(document.querySelectorAll(sel));

  const applyProfile = () => {
    root.classList.remove('profile-brief', 'profile-activity_retro', 'profile-showcase');
    root.classList.add('profile-' + state.profile);
    const select = document.querySelector('[data-profile-select]');
    if (select) select.value = state.profile;
  };

  const applyTabs = (tabId) => {
    bySel('[data-tab]').forEach((node) => {
      const active = node.getAttribute('data-tab') === tabId;
      node.setAttribute('data-active', String(active));
      node.setAttribute('aria-selected', String(active));
    });
    bySel('[data-tab-panel]').forEach((panel) => {
      const active = panel.getAttribute('data-tab-panel') === tabId;
      panel.setAttribute('data-active', String(active));
    });
  };

  const renderTable = () => {
    const rows = bySel('[data-row]');
    rows.forEach((row) => {
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
      const visible = matchesProvider && matchesState && matchesImpact && matchesQuery;
      row.style.display = visible ? '' : 'none';
    });

    const sectionRows = bySel('[data-provider-card], [data-provider-issue], [data-provider-risk]');
    sectionRows.forEach((node) => {
      const provider = node.getAttribute('data-provider') || '';
      node.style.display = state.provider === 'all' || state.provider === provider ? '' : 'none';
    });

    const tableWrap = document.querySelector('[data-table-wrap]');
    if (tableWrap) {
      tableWrap.setAttribute('data-show-optional', String(state.showOptionalCols));
    }

    bySel('[data-provider-chip]').forEach((chip) => {
      chip.setAttribute('data-active', String(chip.getAttribute('data-provider-chip') === state.provider));
    });
  };

  const openSidePanel = (row) => {
    const panel = document.querySelector('[data-sidepanel]');
    if (!panel) return;
    const data = {
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

    Object.entries(data).forEach(([key, value]) => {
      const target = panel.querySelector('[data-panel-' + key + ']');
      if (target) target.textContent = String(value);
    });

    const link = panel.querySelector('[data-panel-link]');
    if (link) {
      if (data.url) {
        link.setAttribute('href', data.url);
        link.removeAttribute('hidden');
      } else {
        link.setAttribute('hidden', 'hidden');
      }
    }

    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    const close = panel.querySelector('[data-sidepanel-close]');
    if (close) close.focus();
  };

  bySel('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => applyTabs(button.getAttribute('data-tab') || 'overview'));
  });

  bySel('[data-provider-chip]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const provider = chip.getAttribute('data-provider-chip') || 'all';
      state.provider = providers.has(provider) ? provider : 'all';
      renderTable();
    });
  });

  const search = document.querySelector('[data-search]');
  if (search) {
    search.addEventListener('input', (event) => {
      state.query = String(event.target.value || '').trim().toLowerCase();
      renderTable();
    });
  }

  const stateFilter = document.querySelector('[data-filter-state]');
  if (stateFilter) {
    stateFilter.addEventListener('change', (event) => {
      state.filterState = String(event.target.value || 'all');
      renderTable();
    });
  }

  const impactFilter = document.querySelector('[data-filter-impact]');
  if (impactFilter) {
    impactFilter.addEventListener('change', (event) => {
      state.filterImpact = String(event.target.value || 'all');
      renderTable();
    });
  }

  const providerFilter = document.querySelector('[data-filter-provider]');
  if (providerFilter) {
    providerFilter.addEventListener('change', (event) => {
      state.provider = String(event.target.value || 'all');
      renderTable();
    });
  }

  const columnsToggle = document.querySelector('[data-columns-toggle]');
  if (columnsToggle) {
    columnsToggle.addEventListener('click', () => {
      state.showOptionalCols = !state.showOptionalCols;
      renderTable();
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

  const copyStandup = document.querySelector('[data-copy-standup]');
  if (copyStandup) {
    copyStandup.addEventListener('click', async () => {
      const bullets = bySel('[data-standup-bullet]').slice(0, 5).map((node) => '- ' + (node.textContent || '').trim()).join('\\n');
      try {
        await navigator.clipboard.writeText(bullets);
        copyStandup.textContent = 'Copied';
        setTimeout(() => { copyStandup.textContent = 'Copy for standup'; }, 1200);
      } catch {
        copyStandup.textContent = 'Copy failed';
        setTimeout(() => { copyStandup.textContent = 'Copy for standup'; }, 1200);
      }
    });
  }

  const exportCsv = document.querySelector('[data-export-csv]');
  if (exportCsv) {
    exportCsv.addEventListener('click', () => {
      const visibleRows = bySel('[data-row]').filter((row) => row.style.display !== 'none');
      const headers = ['Rank','Issue','Provider','State','Bucket','Impact','Updated','Authored','Assigned','Commented'];
      const rows = visibleRows.map((row) => [
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
      const csv = [headers, ...rows].map((line) => line.map((cell) => '"' + String(cell).replaceAll('"', '""') + '"').join(',')).join('\\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'activity-report.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  const exportPdf = document.querySelector('[data-export-pdf]');
  if (exportPdf) exportPdf.addEventListener('click', () => window.print());

  const copyLink = document.querySelector('[data-copy-link]');
  if (copyLink) {
    copyLink.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(window.location.href);
        copyLink.textContent = 'Link copied';
        setTimeout(() => { copyLink.textContent = 'Copy share link'; }, 1200);
      } catch {
        copyLink.textContent = 'Copy failed';
        setTimeout(() => { copyLink.textContent = 'Copy share link'; }, 1200);
      }
    });
  }

  const profileSelect = document.querySelector('[data-profile-select]');
  if (profileSelect) {
    profileSelect.addEventListener('change', (event) => {
      state.profile = String(event.target.value || 'activity_retro');
      applyProfile();
    });
  }

  const popoverToggle = document.querySelector('[data-impact-popover-toggle]');
  const popover = document.querySelector('[data-impact-popover]');
  if (popoverToggle && popover) {
    popoverToggle.addEventListener('click', () => {
      popover.classList.toggle('open');
    });
  }

  const modal = document.querySelector('[data-scoring-modal]');
  const openModal = document.querySelector('[data-open-scoring-modal]');
  const closeModal = document.querySelector('[data-close-scoring-modal]');
  if (modal && openModal && closeModal) {
    openModal.addEventListener('click', () => modal.showModal());
    closeModal.addEventListener('click', () => modal.close());
  }

  applyProfile();
  applyTabs('overview');
  renderTable();
})();
`;
}
function ReportDocument({ payload }) {
  const { summary, narrative, context, normalizedIssues, comparison, coverage } = payload;
  const windowLabel = `${formatHumanDate(context.startDate)} → ${formatHumanDate(context.endDate)}`;
  const generatedAt = formatHumanDateTime(context.generatedAt ?? (/* @__PURE__ */ new Date()).toISOString());
  const providerFromDistribution = new Map(
    payload.providerDistribution.map((segment) => [segment.provider, segment.count])
  );
  const providerSegments = [
    {
      provider: "github",
      count: providerFromDistribution.get("github") ?? summary.byProvider.github
    },
    {
      provider: "gitlab",
      count: providerFromDistribution.get("gitlab") ?? summary.byProvider.gitlab
    },
    {
      provider: "jira",
      count: providerFromDistribution.get("jira") ?? summary.byProvider.jira
    }
  ];
  const providerTotal = providerSegments.reduce(
    (total, segment) => total + segment.count,
    0
  );
  const providerColor = {
    github: "#1d4ed8",
    gitlab: "#0f766e",
    jira: "#b45309"
  };
  const donutGradient = providerTotal === 0 ? "conic-gradient(#cbd5e1 0deg, #cbd5e1 360deg)" : (() => {
    let cumulative = 0;
    const slices = providerSegments.filter((segment) => segment.count > 0).map((segment) => {
      const start = Math.round(cumulative / providerTotal * 360);
      cumulative += segment.count;
      const end = Math.round(cumulative / providerTotal * 360);
      const color = providerColor[segment.provider];
      return `${color} ${start}deg ${end}deg`;
    });
    return `conic-gradient(${slices.join(", ")})`;
  })();
  const completedPct = summary.totalIssues ? Math.round(summary.byBucket.completed / summary.totalIssues * 100) : 0;
  const activePct = summary.totalIssues ? Math.round(summary.byBucket.active / summary.totalIssues * 100) : 0;
  const blockedPct = summary.totalIssues ? Math.round(summary.byBucket.blocked / summary.totalIssues * 100) : 0;
  const collabItems = summary.collaborationHighlights.map((issue) => {
    const count = issue.userCommentCount + (issue.isAssignedToUser ? 1 : 0) + (issue.isAuthoredByUser ? 1 : 0);
    return {
      key: issue.key,
      initials: issue.key.slice(0, 2).toUpperCase(),
      count,
      provider: issue.provider
    };
  });
  return /* @__PURE__ */ jsxs("html", { lang: "en", children: [
    /* @__PURE__ */ jsxs("head", { children: [
      /* @__PURE__ */ jsx("meta", { charSet: "utf-8" }),
      /* @__PURE__ */ jsx("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }),
      /* @__PURE__ */ jsx("title", { children: "Activity Report" }),
      /* @__PURE__ */ jsx("style", { dangerouslySetInnerHTML: { __html: STYLE_BLOCK } }),
      /* @__PURE__ */ jsx("script", { dangerouslySetInnerHTML: { __html: buildClientScript() } })
    ] }),
    /* @__PURE__ */ jsx("body", { children: /* @__PURE__ */ jsxs("main", { className: "shell", "data-root": "true", "data-profile": context.reportProfile, children: [
      /* @__PURE__ */ jsxs("header", { className: "header", children: [
        /* @__PURE__ */ jsxs("div", { className: "header-top", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h1", { className: "title", children: "Activity Report" }),
            /* @__PURE__ */ jsxs("div", { className: "meta", children: [
              "Window: ",
              windowLabel,
              " | Data freshness: ",
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
        /* @__PURE__ */ jsxs("div", { className: "header-controls", children: [
          /* @__PURE__ */ jsx("select", { className: "control", "aria-label": "Window selector", children: /* @__PURE__ */ jsx("option", { children: windowLabel }) }),
          /* @__PURE__ */ jsxs("select", { className: "control", "data-profile-select": true, "aria-label": "Profile selector", children: [
            /* @__PURE__ */ jsx("option", { value: "brief", children: "brief" }),
            /* @__PURE__ */ jsx("option", { value: "activity_retro", children: "activity_retro" }),
            /* @__PURE__ */ jsx("option", { value: "showcase", children: "showcase" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "chips", "aria-label": "Provider filters", children: [
            /* @__PURE__ */ jsx("button", { className: "chip", "data-provider-chip": "all", "data-active": "true", children: "All" }),
            /* @__PURE__ */ jsx("button", { className: "chip", "data-provider-chip": "github", children: "GitHub" }),
            /* @__PURE__ */ jsx("button", { className: "chip", "data-provider-chip": "gitlab", children: "GitLab" }),
            /* @__PURE__ */ jsx("button", { className: "chip", "data-provider-chip": "jira", children: "Jira" })
          ] }),
          /* @__PURE__ */ jsx("button", { className: "button", "data-export-pdf": true, children: "Export PDF" }),
          /* @__PURE__ */ jsx("button", { className: "button", "data-export-csv": true, children: "Export CSV" }),
          /* @__PURE__ */ jsx("button", { className: "button", "data-copy-link": true, children: "Copy share link" })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "meta", style: { marginTop: "8px" }, children: "Profile selector is presentation-only and does not re-fetch or re-score data." })
      ] }),
      /* @__PURE__ */ jsxs("nav", { className: "tabs", "aria-label": "report tabs", children: [
        /* @__PURE__ */ jsx("button", { className: "tab", "data-tab": "overview", "data-active": "true", role: "tab", "aria-selected": "true", children: "Overview" }),
        /* @__PURE__ */ jsx("button", { className: "tab", "data-tab": "highlights", role: "tab", "aria-selected": "false", children: "Highlights" }),
        /* @__PURE__ */ jsx("button", { className: "tab", "data-tab": "issues", role: "tab", "aria-selected": "false", children: "Issues" }),
        /* @__PURE__ */ jsx("button", { className: "tab", "data-tab": "appendix", role: "tab", "aria-selected": "false", children: "Appendix" })
      ] }),
      /* @__PURE__ */ jsx("section", { className: "panel hero", "data-tab-panel": "overview", "data-active": "true", children: /* @__PURE__ */ jsxs("div", { className: "hero-grid", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h2", { className: "section-title", children: "Executive Summary" }),
          /* @__PURE__ */ jsx("p", { className: "headline", children: narrative.executiveHeadline }),
          /* @__PURE__ */ jsxs("div", { className: "meta", style: { marginTop: "8px" }, children: [
            "Providers connected: ",
            coverage.connectedProviderCount,
            "/",
            coverage.totalProviderCount,
            coverage.partialFailures > 0 ? ` | Partial failures: ${coverage.partialFailures}` : " | No provider failures"
          ] }),
          !comparison.available ? /* @__PURE__ */ jsx("div", { className: "empty", style: { marginTop: "12px" }, children: "Week-over-week deltas are unavailable for this report source. Add previous-window files or run fetch." }) : /* @__PURE__ */ jsx("div", { className: "delta-grid", children: [
            ["Completed", comparison.completed],
            ["Active", comparison.active],
            ["Blocked", comparison.blocked],
            ["Comments", comparison.comments]
          ].map(([label, value]) => {
            const metric = value;
            const sign = metric.delta > 0 ? "+" : "";
            return /* @__PURE__ */ jsxs("div", { className: "delta", children: [
              /* @__PURE__ */ jsx("p", { className: "delta-label", children: label }),
              /* @__PURE__ */ jsx("p", { className: "delta-value", children: metric.current }),
              /* @__PURE__ */ jsxs("div", { className: `delta-change ${deltaTone(metric.delta)}`, children: [
                sign,
                metric.delta,
                " vs previous (",
                metric.previous,
                ")"
              ] })
            ] }, String(label));
          }) })
        ] }),
        /* @__PURE__ */ jsx("aside", { children: /* @__PURE__ */ jsxs("div", { className: "panel", style: { marginBottom: 0, padding: "12px" }, children: [
          /* @__PURE__ */ jsx("h3", { className: "section-title", style: { marginBottom: "8px" }, children: "Distribution" }),
          /* @__PURE__ */ jsx(
            "div",
            {
              className: "donut",
              "aria-label": "provider distribution donut",
              style: { "--donut-gradient": donutGradient }
            }
          ),
          /* @__PURE__ */ jsx("div", { className: "meta", style: { marginTop: "8px" }, children: providerSegments.map((segment) => `${PROVIDER_LABEL[segment.provider]} ${segment.count}`).join(" | ") }),
          /* @__PURE__ */ jsxs("div", { className: "state-bars", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsxs("div", { className: "meta", children: [
                "Completed ",
                completedPct,
                "%"
              ] }),
              /* @__PURE__ */ jsx("div", { className: "bar bar-completed", children: /* @__PURE__ */ jsx("span", { style: { width: `${completedPct}%` } }) })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsxs("div", { className: "meta", children: [
                "Active ",
                activePct,
                "%"
              ] }),
              /* @__PURE__ */ jsx("div", { className: "bar bar-active", children: /* @__PURE__ */ jsx("span", { style: { width: `${activePct}%` } }) })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsxs("div", { className: "meta", children: [
                "Blocked ",
                blockedPct,
                "%"
              ] }),
              /* @__PURE__ */ jsx("div", { className: "bar bar-blocked", children: /* @__PURE__ */ jsx("span", { style: { width: `${blockedPct}%` } }) })
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "trend", "data-density": "dense-hide-brief", children: payload.trendSeries.length ? payload.trendSeries.map((point) => `${point.label}: C${point.completed} A${point.active} B${point.blocked}`).join(" | ") : "Trend sparkline unavailable for this run." })
        ] }) })
      ] }) }),
      /* @__PURE__ */ jsxs("section", { className: "panel", "data-tab-panel": "overview", "data-active": "true", children: [
        /* @__PURE__ */ jsx("h2", { className: "section-title", children: "KPI Strip" }),
        /* @__PURE__ */ jsxs("div", { className: "kpi-strip", children: [
          /* @__PURE__ */ jsxs("div", { className: "stat", children: [
            /* @__PURE__ */ jsx("p", { children: "Completed" }),
            /* @__PURE__ */ jsx("strong", { children: summary.byBucket.completed })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "stat", children: [
            /* @__PURE__ */ jsx("p", { children: "Active" }),
            /* @__PURE__ */ jsx("strong", { children: summary.byBucket.active })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "stat", children: [
            /* @__PURE__ */ jsx("p", { children: "Blocked" }),
            /* @__PURE__ */ jsx("strong", { children: summary.byBucket.blocked })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "stat", children: [
            /* @__PURE__ */ jsx("p", { children: "High Priority" }),
            /* @__PURE__ */ jsx("strong", { children: summary.highPriorityLabelIssues })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "stat", children: [
            /* @__PURE__ */ jsx("p", { children: "Comments" }),
            /* @__PURE__ */ jsx("strong", { children: summary.contribution.totalUserComments })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "stat", "data-density": "dense-hide-brief", children: [
            /* @__PURE__ */ jsx("p", { children: "Total Items" }),
            /* @__PURE__ */ jsx("strong", { children: summary.totalIssues })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("details", { className: "more-kpis", "data-density": "dense-hide-activity_retro", children: [
          /* @__PURE__ */ jsx("summary", { children: "View more KPIs" }),
          /* @__PURE__ */ jsxs("div", { className: "kpi-strip", style: { marginTop: "8px" }, children: [
            /* @__PURE__ */ jsxs("div", { className: "stat", children: [
              /* @__PURE__ */ jsx("p", { children: "Contributed Issues" }),
              /* @__PURE__ */ jsx("strong", { children: summary.contribution.contributedIssues })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "stat", children: [
              /* @__PURE__ */ jsx("p", { children: "GitHub" }),
              /* @__PURE__ */ jsx("strong", { children: summary.byProvider.github })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "stat", children: [
              /* @__PURE__ */ jsx("p", { children: "GitLab" }),
              /* @__PURE__ */ jsx("strong", { children: summary.byProvider.gitlab })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "stat", children: [
              /* @__PURE__ */ jsx("p", { children: "Jira" }),
              /* @__PURE__ */ jsx("strong", { children: summary.byProvider.jira })
            ] })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx("section", { className: "panel", "data-tab-panel": "highlights", children: /* @__PURE__ */ jsxs("div", { className: "split", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h2", { className: "section-title", children: "Top Highlights" }),
          /* @__PURE__ */ jsx("div", { className: "issue-list", children: summary.topActivityHighlights.length ? summary.topActivityHighlights.map((issue, index) => {
            const wording = narrative.topHighlightWording[index] ?? issue.descriptionSnippet;
            return /* @__PURE__ */ jsxs("article", { className: `issue-row ${bucketToneClass(issue.bucket)}`, "data-provider-issue": "true", "data-provider": issue.provider, children: [
              /* @__PURE__ */ jsxs("div", { className: "issue-head", children: [
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsxs("div", { className: "issue-key", children: [
                    PROVIDER_LABEL[issue.provider],
                    " · ",
                    issue.key
                  ] }),
                  /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx("strong", { children: issue.title }) })
                ] }),
                /* @__PURE__ */ jsxs("span", { className: "badge mono", children: [
                  "Impact ",
                  issue.impactScore
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "meta", children: [
                issue.state,
                " · Updated ",
                formatHumanDateTime(issue.updatedAt)
              ] }),
              /* @__PURE__ */ jsx("p", { children: wording })
            ] }, `${issue.provider}-${issue.key}`);
          }) : /* @__PURE__ */ jsx("div", { className: "empty", children: "No high-impact items detected this window. Try widening the window or lowering the impact threshold." }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h2", { className: "section-title", children: "Risks and Follow-ups" }),
          /* @__PURE__ */ jsx("div", { className: "issue-list", children: narrative.risksAndFollowUps.length ? narrative.risksAndFollowUps.map((line, index) => {
            const parsed = parseRiskLine(line);
            const sourceIssue = summary.risksAndFollowUps[index];
            return /* @__PURE__ */ jsxs("article", { className: "issue-row tone-blocked", "data-provider-risk": "true", "data-provider": sourceIssue?.provider ?? "github", children: [
              /* @__PURE__ */ jsxs("div", { className: "issue-head", children: [
                /* @__PURE__ */ jsx("strong", { children: parsed.context }),
                sourceIssue?.url ? /* @__PURE__ */ jsx("a", { className: "badge", href: sourceIssue.url, children: "Open issue" }) : /* @__PURE__ */ jsx("span", { className: "badge", children: "Follow-up" })
              ] }),
              /* @__PURE__ */ jsx("p", { children: parsed.action })
            ] }, `${line}-${index}`);
          }) : /* @__PURE__ */ jsx("div", { className: "empty", children: "No urgent blockers identified. Review active high-impact work to keep momentum." }) })
        ] })
      ] }) }),
      /* @__PURE__ */ jsxs("section", { className: "panel", "data-tab-panel": "issues", children: [
        /* @__PURE__ */ jsx("h2", { className: "section-title", children: "Collaboration" }),
        /* @__PURE__ */ jsxs("div", { className: "collab-grid", children: [
          /* @__PURE__ */ jsxs("div", { className: "stat", children: [
            /* @__PURE__ */ jsx("p", { children: "Collaborative issues" }),
            /* @__PURE__ */ jsx("strong", { children: summary.contribution.contributedIssues }),
            /* @__PURE__ */ jsxs("div", { className: "meta", children: [
              "Comment footprint: ",
              summary.contribution.totalUserComments
            ] })
          ] }),
          /* @__PURE__ */ jsx("ul", { className: "collab-list", children: collabItems.length ? collabItems.map((item) => /* @__PURE__ */ jsxs("li", { className: "collab-item", "data-provider-card": "true", "data-provider": item.provider, children: [
            /* @__PURE__ */ jsx("span", { className: "avatar", children: item.initials }),
            /* @__PURE__ */ jsx("span", { children: item.key }),
            /* @__PURE__ */ jsx("span", { className: "mono", style: { marginLeft: "auto" }, children: item.count })
          ] }, item.key)) : /* @__PURE__ */ jsx("li", { className: "empty", children: "No collaboration spikes in this window." }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("section", { className: "panel", "data-tab-panel": "issues", children: [
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }, children: [
          /* @__PURE__ */ jsxs("h2", { className: "section-title", style: { marginBottom: 0 }, children: [
            "Talking Points",
            /* @__PURE__ */ jsx("span", { className: "impact-info", "data-impact-popover-toggle": true, children: "Impact score info" }),
            /* @__PURE__ */ jsx("span", { className: "popover", "data-impact-popover": true, children: "80+: high-impact. 50-79: meaningful progress. 0-49: lower impact or early-stage." })
          ] }),
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: "8px" }, children: [
            /* @__PURE__ */ jsx("button", { className: "button", "data-copy-standup": true, children: "Copy for standup" }),
            /* @__PURE__ */ jsx("button", { className: "button ghost", "data-open-scoring-modal": true, children: "How scoring works" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("details", { children: [
          /* @__PURE__ */ jsx("summary", { children: "Expand talking points" }),
          /* @__PURE__ */ jsx("div", { className: "issue-list", style: { marginTop: "8px" }, children: narrative.weeklyTalkingPoints.length ? narrative.weeklyTalkingPoints.slice(0, 5).map((point, index) => /* @__PURE__ */ jsxs("article", { className: "issue-row tone-active", children: [
            /* @__PURE__ */ jsx("strong", { children: point.lead }),
            /* @__PURE__ */ jsx("ul", { children: point.bullets.slice(0, 5).map((bullet, bIndex) => /* @__PURE__ */ jsx("li", { "data-standup-bullet": true, children: bullet }, `${bullet}-${bIndex}`)) })
          ] }, `${point.lead}-${index}`)) : /* @__PURE__ */ jsx("div", { className: "empty", children: "No talking points generated for this run." }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("section", { className: "panel", "data-tab-panel": "appendix", children: [
        /* @__PURE__ */ jsx("h2", { className: "section-title", children: "Appendix" }),
        /* @__PURE__ */ jsxs("div", { className: "table-toolbar", children: [
          /* @__PURE__ */ jsx("input", { className: "control", "data-search": true, placeholder: "Search issue/title" }),
          /* @__PURE__ */ jsxs("select", { className: "control", "data-filter-state": true, children: [
            /* @__PURE__ */ jsx("option", { value: "all", children: "State" }),
            /* @__PURE__ */ jsx("option", { value: "open", children: "Open" }),
            /* @__PURE__ */ jsx("option", { value: "closed", children: "Closed/Done" }),
            /* @__PURE__ */ jsx("option", { value: "blocked", children: "Blocked" })
          ] }),
          /* @__PURE__ */ jsxs("select", { className: "control", "data-filter-provider": true, children: [
            /* @__PURE__ */ jsx("option", { value: "all", children: "Provider" }),
            /* @__PURE__ */ jsx("option", { value: "github", children: "GitHub" }),
            /* @__PURE__ */ jsx("option", { value: "gitlab", children: "GitLab" }),
            /* @__PURE__ */ jsx("option", { value: "jira", children: "Jira" })
          ] }),
          /* @__PURE__ */ jsxs("select", { className: "control", "data-filter-impact": true, children: [
            /* @__PURE__ */ jsx("option", { value: "all", children: "Impact" }),
            /* @__PURE__ */ jsx("option", { value: "high", children: "High (80+)" }),
            /* @__PURE__ */ jsx("option", { value: "medium", children: "Medium (50-79)" }),
            /* @__PURE__ */ jsx("option", { value: "low", children: "Low (<50)" })
          ] }),
          /* @__PURE__ */ jsx("button", { className: "button", "data-columns-toggle": true, children: "Columns" })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "table-wrap", "data-table-wrap": true, "data-show-optional": "false", children: /* @__PURE__ */ jsxs("table", { children: [
          /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("th", { children: "Rank" }),
            /* @__PURE__ */ jsx("th", { children: "Issue" }),
            /* @__PURE__ */ jsx("th", { children: "State" }),
            /* @__PURE__ */ jsx("th", { children: "Impact" }),
            /* @__PURE__ */ jsx("th", { children: "Updated" }),
            /* @__PURE__ */ jsx("th", { className: "col-optional", children: "Provider" }),
            /* @__PURE__ */ jsx("th", { className: "col-optional", children: "Bucket" }),
            /* @__PURE__ */ jsx("th", { className: "col-optional", children: "Authored" }),
            /* @__PURE__ */ jsx("th", { className: "col-optional", children: "Assigned" }),
            /* @__PURE__ */ jsx("th", { className: "col-optional", children: "Commented" })
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
                /* @__PURE__ */ jsx("td", { children: issue.state }),
                /* @__PURE__ */ jsx("td", { className: "mono", children: issue.impactScore }),
                /* @__PURE__ */ jsx("td", { children: formatHumanDateTime(issue.updatedAt) }),
                /* @__PURE__ */ jsx("td", { className: "col-optional", children: PROVIDER_LABEL[issue.provider] }),
                /* @__PURE__ */ jsx("td", { className: "col-optional", children: BUCKET_LABEL[issue.bucket] }),
                /* @__PURE__ */ jsx("td", { className: "col-optional mono", children: issue.isAuthoredByUser ? "yes" : "no" }),
                /* @__PURE__ */ jsx("td", { className: "col-optional mono", children: issue.isAssignedToUser ? "yes" : "no" }),
                /* @__PURE__ */ jsx("td", { className: "col-optional mono", children: issue.isCommentedByUser ? "yes" : "no" })
              ]
            },
            `${issue.provider}-${issue.key}-${index}`
          )) : /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", { colSpan: 10, children: /* @__PURE__ */ jsx("div", { className: "empty", children: "No issues matched your filters. Clear filters or connect a provider." }) }) }) })
        ] }) })
      ] }),
      /* @__PURE__ */ jsxs("aside", { className: "sidepanel", "data-sidepanel": true, "aria-hidden": "true", children: [
        /* @__PURE__ */ jsxs("div", { className: "sidepanel-head", children: [
          /* @__PURE__ */ jsx("strong", { children: "Issue Details" }),
          /* @__PURE__ */ jsx("button", { className: "button", "data-sidepanel-close": true, children: "Close" })
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
      ] }),
      /* @__PURE__ */ jsxs("dialog", { "data-scoring-modal": true, children: [
        /* @__PURE__ */ jsxs("div", { className: "modal-head", children: [
          /* @__PURE__ */ jsx("strong", { children: "How scoring works" }),
          /* @__PURE__ */ jsx("button", { className: "button", "data-close-scoring-modal": true, children: "Close" })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "modal-body", children: /* @__PURE__ */ jsxs("ul", { children: [
          /* @__PURE__ */ jsx("li", { children: "completed +40" }),
          /* @__PURE__ */ jsx("li", { children: "active +20" }),
          /* @__PURE__ */ jsx("li", { children: "blocked +10" }),
          /* @__PURE__ */ jsx("li", { children: "authored +15" }),
          /* @__PURE__ */ jsx("li", { children: "assigned +10" }),
          /* @__PURE__ */ jsx("li", { children: "user comments +2 each (max +10)" }),
          /* @__PURE__ */ jsx("li", { children: "high-impact labels +12" }),
          /* @__PURE__ */ jsx("li", { children: "updated in final 48h +8" })
        ] }) })
      ] })
    ] }) })
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

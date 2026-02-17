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

interface ComparisonDelta {
  current: number;
  previous: number;
  delta: number;
}

interface ReportComparisonSummary {
  available: boolean;
  completed: ComparisonDelta | null;
  active: ComparisonDelta | null;
  blocked: ComparisonDelta | null;
  comments: ComparisonDelta | null;
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

interface TrendPoint {
  label: string;
  completed: number;
  active: number;
  blocked: number;
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
  comparison: ReportComparisonSummary;
  coverage: ReportCoverageSummary;
  providerDistribution: Array<{ provider: ProviderName; count: number }>;
  trendSeries: TrendPoint[];
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

function deltaTone(delta: number): string {
  if (delta > 0) return "delta-up";
  if (delta < 0) return "delta-down";
  return "delta-flat";
}

function bucketToneClass(bucket: ActivityBucket): string {
  if (bucket === "completed") return "tone-completed";
  if (bucket === "active") return "tone-active";
  if (bucket === "blocked") return "tone-blocked";
  return "tone-other";
}

function parseRiskLine(value: string): { context: string; action: string } {
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

function ReportDocument({ payload }: { payload: RenderPayload }) {
  const { summary, narrative, context, normalizedIssues, comparison, coverage } =
    payload;
  const windowLabel = `${formatHumanDate(context.startDate)} → ${formatHumanDate(context.endDate)}`;
  const generatedAt = formatHumanDateTime(context.generatedAt ?? new Date().toISOString());

  const providerFromDistribution = new Map(
    payload.providerDistribution.map((segment) => [segment.provider, segment.count]),
  );
  const providerSegments = [
    {
      provider: "github" as const,
      count: providerFromDistribution.get("github") ?? summary.byProvider.github,
    },
    {
      provider: "gitlab" as const,
      count: providerFromDistribution.get("gitlab") ?? summary.byProvider.gitlab,
    },
    {
      provider: "jira" as const,
      count: providerFromDistribution.get("jira") ?? summary.byProvider.jira,
    },
  ];
  const providerTotal = providerSegments.reduce(
    (total, segment) => total + segment.count,
    0,
  );
  const providerColor: Record<ProviderName, string> = {
    github: "#1d4ed8",
    gitlab: "#0f766e",
    jira: "#b45309",
  };
  const donutGradient = providerTotal === 0
    ? "conic-gradient(#cbd5e1 0deg, #cbd5e1 360deg)"
    : (() => {
      let cumulative = 0;
      const slices = providerSegments
        .filter((segment) => segment.count > 0)
        .map((segment) => {
          const start = Math.round((cumulative / providerTotal) * 360);
          cumulative += segment.count;
          const end = Math.round((cumulative / providerTotal) * 360);
          const color = providerColor[segment.provider];
          return `${color} ${start}deg ${end}deg`;
        });
      return `conic-gradient(${slices.join(", ")})`;
    })();

  const completedPct = summary.totalIssues
    ? Math.round((summary.byBucket.completed / summary.totalIssues) * 100)
    : 0;
  const activePct = summary.totalIssues
    ? Math.round((summary.byBucket.active / summary.totalIssues) * 100)
    : 0;
  const blockedPct = summary.totalIssues
    ? Math.round((summary.byBucket.blocked / summary.totalIssues) * 100)
    : 0;

  const collabItems = summary.collaborationHighlights.map((issue) => {
    const count = issue.userCommentCount + (issue.isAssignedToUser ? 1 : 0) +
      (issue.isAuthoredByUser ? 1 : 0);
    return {
      key: issue.key,
      initials: issue.key.slice(0, 2).toUpperCase(),
      count,
      provider: issue.provider,
    };
  });

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Activity Report</title>
        <style dangerouslySetInnerHTML={{ __html: STYLE_BLOCK }} />
        <script dangerouslySetInnerHTML={{ __html: buildClientScript() }} />
      </head>
      <body>
        <main className="shell" data-root="true" data-profile={context.reportProfile}>
          <header className="header">
            <div className="header-top">
              <div>
                <h1 className="title">Activity Report</h1>
                <div className="meta">Window: {windowLabel} | Data freshness: {generatedAt}</div>
              </div>
              <div className="meta">Source: {context.sourceMode ?? "report"} | Fetch mode: {context.fetchMode}</div>
            </div>
            <div className="header-controls">
              <select className="control" aria-label="Window selector">
                <option>{windowLabel}</option>
              </select>
              <select className="control" data-profile-select aria-label="Profile selector">
                <option value="brief">brief</option>
                <option value="activity_retro">activity_retro</option>
                <option value="showcase">showcase</option>
              </select>
              <div className="chips" aria-label="Provider filters">
                <button className="chip" data-provider-chip="all" data-active="true">All</button>
                <button className="chip" data-provider-chip="github">GitHub</button>
                <button className="chip" data-provider-chip="gitlab">GitLab</button>
                <button className="chip" data-provider-chip="jira">Jira</button>
              </div>
              <button className="button" data-export-pdf>Export PDF</button>
              <button className="button" data-export-csv>Export CSV</button>
              <button className="button" data-copy-link>Copy share link</button>
            </div>
            <div className="meta" style={{ marginTop: "8px" }}>
              Profile selector is presentation-only and does not re-fetch or re-score data.
            </div>
          </header>

          <nav className="tabs" aria-label="report tabs">
            <button className="tab" data-tab="overview" data-active="true" role="tab" aria-selected="true">Overview</button>
            <button className="tab" data-tab="highlights" role="tab" aria-selected="false">Highlights</button>
            <button className="tab" data-tab="issues" role="tab" aria-selected="false">Issues</button>
            <button className="tab" data-tab="appendix" role="tab" aria-selected="false">Appendix</button>
          </nav>

          <section className="panel hero" data-tab-panel="overview" data-active="true">
            <div className="hero-grid">
              <div>
                <h2 className="section-title">Executive Summary</h2>
                <p className="headline">{narrative.executiveHeadline}</p>
                <div className="meta" style={{ marginTop: "8px" }}>
                  Providers connected: {coverage.connectedProviderCount}/{coverage.totalProviderCount}
                  {coverage.partialFailures > 0 ? ` | Partial failures: ${coverage.partialFailures}` : " | No provider failures"}
                </div>
                {!comparison.available
                  ? (
                    <div className="empty" style={{ marginTop: "12px" }}>
                      Week-over-week deltas are unavailable for this report source. Add previous-window files or run fetch.
                    </div>
                  )
                  : (
                    <div className="delta-grid">
                      {[
                        ["Completed", comparison.completed],
                        ["Active", comparison.active],
                        ["Blocked", comparison.blocked],
                        ["Comments", comparison.comments],
                      ].map(([label, value]) => {
                        const metric = value as ComparisonDelta;
                        const sign = metric.delta > 0 ? "+" : "";
                        return (
                          <div className="delta" key={String(label)}>
                            <p className="delta-label">{label}</p>
                            <p className="delta-value">{metric.current}</p>
                            <div className={`delta-change ${deltaTone(metric.delta)}`}>
                              {sign}{metric.delta} vs previous ({metric.previous})
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
              </div>
              <aside>
                <div className="panel" style={{ marginBottom: 0, padding: "12px" }}>
                  <h3 className="section-title" style={{ marginBottom: "8px" }}>Distribution</h3>
                  <div
                    className="donut"
                    aria-label="provider distribution donut"
                    style={{ "--donut-gradient": donutGradient } as React.CSSProperties}
                  />
                  <div className="meta" style={{ marginTop: "8px" }}>
                    {providerSegments.map((segment) => `${PROVIDER_LABEL[segment.provider]} ${segment.count}`).join(" | ")}
                  </div>
                  <div className="state-bars">
                    <div><div className="meta">Completed {completedPct}%</div><div className="bar bar-completed"><span style={{ width: `${completedPct}%` }} /></div></div>
                    <div><div className="meta">Active {activePct}%</div><div className="bar bar-active"><span style={{ width: `${activePct}%` }} /></div></div>
                    <div><div className="meta">Blocked {blockedPct}%</div><div className="bar bar-blocked"><span style={{ width: `${blockedPct}%` }} /></div></div>
                  </div>
                  <div className="trend" data-density="dense-hide-brief">
                    {payload.trendSeries.length
                      ? payload.trendSeries.map((point) => `${point.label}: C${point.completed} A${point.active} B${point.blocked}`).join(" | ")
                      : "Trend sparkline unavailable for this run."}
                  </div>
                </div>
              </aside>
            </div>
          </section>

          <section className="panel" data-tab-panel="overview" data-active="true">
            <h2 className="section-title">KPI Strip</h2>
            <div className="kpi-strip">
              <div className="stat"><p>Completed</p><strong>{summary.byBucket.completed}</strong></div>
              <div className="stat"><p>Active</p><strong>{summary.byBucket.active}</strong></div>
              <div className="stat"><p>Blocked</p><strong>{summary.byBucket.blocked}</strong></div>
              <div className="stat"><p>High Priority</p><strong>{summary.highPriorityLabelIssues}</strong></div>
              <div className="stat"><p>Comments</p><strong>{summary.contribution.totalUserComments}</strong></div>
              <div className="stat" data-density="dense-hide-brief"><p>Total Items</p><strong>{summary.totalIssues}</strong></div>
            </div>
            <details className="more-kpis" data-density="dense-hide-activity_retro">
              <summary>View more KPIs</summary>
              <div className="kpi-strip" style={{ marginTop: "8px" }}>
                <div className="stat"><p>Contributed Issues</p><strong>{summary.contribution.contributedIssues}</strong></div>
                <div className="stat"><p>GitHub</p><strong>{summary.byProvider.github}</strong></div>
                <div className="stat"><p>GitLab</p><strong>{summary.byProvider.gitlab}</strong></div>
                <div className="stat"><p>Jira</p><strong>{summary.byProvider.jira}</strong></div>
              </div>
            </details>
          </section>

          <section className="panel" data-tab-panel="highlights">
            <div className="split">
              <div>
                <h2 className="section-title">Top Highlights</h2>
                <div className="issue-list">
                  {summary.topActivityHighlights.length
                    ? summary.topActivityHighlights.map((issue, index) => {
                      const wording = narrative.topHighlightWording[index] ?? issue.descriptionSnippet;
                      return (
                        <article key={`${issue.provider}-${issue.key}`} className={`issue-row ${bucketToneClass(issue.bucket)}`} data-provider-issue="true" data-provider={issue.provider}>
                          <div className="issue-head">
                            <div>
                              <div className="issue-key">{PROVIDER_LABEL[issue.provider]} · {issue.key}</div>
                              <div><strong>{issue.title}</strong></div>
                            </div>
                            <span className="badge mono">Impact {issue.impactScore}</span>
                          </div>
                          <div className="meta">{issue.state} · Updated {formatHumanDateTime(issue.updatedAt)}</div>
                          <p>{wording}</p>
                        </article>
                      );
                    })
                    : (
                      <div className="empty">
                        No high-impact items detected this window. Try widening the window or lowering the impact threshold.
                      </div>
                    )}
                </div>
              </div>
              <div>
                <h2 className="section-title">Risks and Follow-ups</h2>
                <div className="issue-list">
                  {narrative.risksAndFollowUps.length
                    ? narrative.risksAndFollowUps.map((line, index) => {
                      const parsed = parseRiskLine(line);
                      const sourceIssue = summary.risksAndFollowUps[index];
                      return (
                        <article key={`${line}-${index}`} className="issue-row tone-blocked" data-provider-risk="true" data-provider={sourceIssue?.provider ?? "github"}>
                          <div className="issue-head">
                            <strong>{parsed.context}</strong>
                            {sourceIssue?.url
                              ? <a className="badge" href={sourceIssue.url}>Open issue</a>
                              : <span className="badge">Follow-up</span>}
                          </div>
                          <p>{parsed.action}</p>
                        </article>
                      );
                    })
                    : (
                      <div className="empty">
                        No urgent blockers identified. Review active high-impact work to keep momentum.
                      </div>
                    )}
                </div>
              </div>
            </div>
          </section>

          <section className="panel" data-tab-panel="issues">
            <h2 className="section-title">Collaboration</h2>
            <div className="collab-grid">
              <div className="stat">
                <p>Collaborative issues</p>
                <strong>{summary.contribution.contributedIssues}</strong>
                <div className="meta">Comment footprint: {summary.contribution.totalUserComments}</div>
              </div>
              <ul className="collab-list">
                {collabItems.length
                  ? collabItems.map((item) => (
                    <li key={item.key} className="collab-item" data-provider-card="true" data-provider={item.provider}>
                      <span className="avatar">{item.initials}</span>
                      <span>{item.key}</span>
                      <span className="mono" style={{ marginLeft: "auto" }}>{item.count}</span>
                    </li>
                  ))
                  : <li className="empty">No collaboration spikes in this window.</li>}
              </ul>
            </div>
          </section>

          <section className="panel" data-tab-panel="issues">
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
              <h2 className="section-title" style={{ marginBottom: 0 }}>
                Talking Points
                <span className="impact-info" data-impact-popover-toggle>Impact score info</span>
                <span className="popover" data-impact-popover>
                  80+: high-impact. 50-79: meaningful progress. 0-49: lower impact or early-stage.
                </span>
              </h2>
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="button" data-copy-standup>Copy for standup</button>
                <button className="button ghost" data-open-scoring-modal>How scoring works</button>
              </div>
            </div>
            <details>
              <summary>Expand talking points</summary>
              <div className="issue-list" style={{ marginTop: "8px" }}>
                {narrative.weeklyTalkingPoints.length
                  ? narrative.weeklyTalkingPoints.slice(0, 5).map((point, index) => (
                    <article className="issue-row tone-active" key={`${point.lead}-${index}`}>
                      <strong>{point.lead}</strong>
                      <ul>
                        {point.bullets.slice(0, 5).map((bullet, bIndex) => <li key={`${bullet}-${bIndex}`} data-standup-bullet>{bullet}</li>)}
                      </ul>
                    </article>
                  ))
                  : <div className="empty">No talking points generated for this run.</div>}
              </div>
            </details>
          </section>

          <section className="panel" data-tab-panel="appendix">
            <h2 className="section-title">Appendix</h2>
            <div className="table-toolbar">
              <input className="control" data-search placeholder="Search issue/title" />
              <select className="control" data-filter-state>
                <option value="all">State</option>
                <option value="open">Open</option>
                <option value="closed">Closed/Done</option>
                <option value="blocked">Blocked</option>
              </select>
              <select className="control" data-filter-provider>
                <option value="all">Provider</option>
                <option value="github">GitHub</option>
                <option value="gitlab">GitLab</option>
                <option value="jira">Jira</option>
              </select>
              <select className="control" data-filter-impact>
                <option value="all">Impact</option>
                <option value="high">High (80+)</option>
                <option value="medium">Medium (50-79)</option>
                <option value="low">Low (&lt;50)</option>
              </select>
              <button className="button" data-columns-toggle>Columns</button>
            </div>
            <div className="table-wrap" data-table-wrap data-show-optional="false">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Issue</th>
                    <th>State</th>
                    <th>Impact</th>
                    <th>Updated</th>
                    <th className="col-optional">Provider</th>
                    <th className="col-optional">Bucket</th>
                    <th className="col-optional">Authored</th>
                    <th className="col-optional">Assigned</th>
                    <th className="col-optional">Commented</th>
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
                        <td>{issue.state}</td>
                        <td className="mono">{issue.impactScore}</td>
                        <td>{formatHumanDateTime(issue.updatedAt)}</td>
                        <td className="col-optional">{PROVIDER_LABEL[issue.provider]}</td>
                        <td className="col-optional">{BUCKET_LABEL[issue.bucket]}</td>
                        <td className="col-optional mono">{issue.isAuthoredByUser ? "yes" : "no"}</td>
                        <td className="col-optional mono">{issue.isAssignedToUser ? "yes" : "no"}</td>
                        <td className="col-optional mono">{issue.isCommentedByUser ? "yes" : "no"}</td>
                      </tr>
                    ))
                    : (
                      <tr>
                        <td colSpan={10}>
                          <div className="empty">
                            No issues matched your filters. Clear filters or connect a provider.
                          </div>
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
              <button className="button" data-sidepanel-close>Close</button>
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

          <dialog data-scoring-modal>
            <div className="modal-head">
              <strong>How scoring works</strong>
              <button className="button" data-close-scoring-modal>Close</button>
            </div>
            <div className="modal-body">
              <ul>
                <li>completed +40</li>
                <li>active +20</li>
                <li>blocked +10</li>
                <li>authored +15</li>
                <li>assigned +10</li>
                <li>user comments +2 each (max +10)</li>
                <li>high-impact labels +12</li>
                <li>updated in final 48h +8</li>
              </ul>
            </div>
          </dialog>
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
  process.stderr.write(`shadcn renderer failed: ${message}\n`);
  process.exit(1);
});

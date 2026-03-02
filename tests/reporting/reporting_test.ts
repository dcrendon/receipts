import {
  assertEquals,
  assertNotEquals,
  assertStringIncludes,
} from "@std/assert";
import {
  buildReportSummary,
  buildRunReport,
  normalizeProviderIssues,
} from "../../reporting/reporting.ts";

Deno.test("normalizeProviderIssues normalizes attribution fields across providers", () => {
  const gitlab = normalizeProviderIssues("gitlab", [{
    id: 1,
    iid: 10,
    title: "GL issue",
    state: "opened",
    created_at: "2026-02-01T00:00:00Z",
    updated_at: "2026-02-02T00:00:00Z",
    author: { username: "mock.user" },
    assignees: [{ username: "teammate" }],
    labels: ["bug"],
    description: "A gitlab description",
    notes: [{ id: 1, author: { username: "mock.user" } }],
  }], "mock.user");

  const jira = normalizeProviderIssues("jira", [{
    id: "20",
    key: "J-1",
    fields: {
      summary: "Jira issue",
      status: { name: "Done" },
      created: "2026-02-01T00:00:00Z",
      updated: "2026-02-03T00:00:00Z",
      reporter: { displayName: "teammate" },
      assignee: { displayName: "mock.user" },
      labels: ["ops"],
      description: "jira desc",
    },
    notes: [{ id: "n1", author: { displayName: "mock.user" } }],
  }], "mock.user");

  const github = normalizeProviderIssues("github", [{
    id: 3,
    number: 99,
    title: "GH issue",
    state: "closed",
    body: "github description",
    created_at: "2026-02-01T00:00:00Z",
    updated_at: "2026-02-04T00:00:00Z",
    user: { login: "teammate" },
    assignees: [{ login: "mock.user" }],
    labels: [{ name: "enhancement" }],
    comments: 3,
    notes: [{ id: 1, user: { login: "mock.user" } }],
  }], "mock.user");

  assertEquals(gitlab[0].provider, "gitlab");
  assertEquals(gitlab[0].bucket, "active");
  assertEquals(gitlab[0].isAuthoredByUser, true);
  assertEquals(gitlab[0].isCommentedByUser, true);
  assertEquals(gitlab[0].userCommentCount, 1);
  assertEquals(gitlab[0].description, "A gitlab description");
  assertEquals(gitlab[0].descriptionSnippet, "A gitlab description");

  assertEquals(jira[0].provider, "jira");
  assertEquals(jira[0].bucket, "completed");
  assertEquals(jira[0].isAssignedToUser, true);
  assertEquals(jira[0].isCommentedByUser, true);

  assertEquals(github[0].provider, "github");
  assertEquals(github[0].bucket, "completed");
  assertEquals(github[0].isAssignedToUser, true);
  assertEquals(github[0].commentCount, 3);
});

Deno.test("buildReportSummary aggregates buckets and contribution counters", () => {
  const summary = buildReportSummary([
    {
      id: "a",
      provider: "gitlab",
      sourceId: "1",
      key: "GL-1",
      title: "A",
      state: "open",
      bucket: "active",
      createdAt: "2026-02-01T00:00:00Z",
      updatedAt: "2026-02-01T00:00:00Z",
      assignees: [],
      labels: ["bug"],
      commentCount: 0,
      contributedByUser: true,
      isAuthoredByUser: true,
      isAssignedToUser: false,
      isCommentedByUser: false,
      userCommentCount: 0,
      impactScore: 20,
      description: "",
      descriptionSnippet: "",
    },
    {
      id: "b",
      provider: "github",
      sourceId: "2",
      key: "GH-2",
      title: "B",
      state: "closed",
      bucket: "completed",
      createdAt: "2026-02-01T00:00:00Z",
      updatedAt: "2026-02-03T00:00:00Z",
      assignees: [],
      labels: ["p1", "ops"],
      commentCount: 2,
      contributedByUser: true,
      isAuthoredByUser: false,
      isAssignedToUser: true,
      isCommentedByUser: true,
      userCommentCount: 2,
      impactScore: 65,
      description: "",
      descriptionSnippet: "",
    },
  ]);

  assertEquals(summary.totalIssues, 2);
  assertEquals(summary.byProvider.gitlab, 1);
  assertEquals(summary.byProvider.github, 1);
  assertEquals(summary.byBucket.active, 1);
  assertEquals(summary.byBucket.completed, 1);
  assertEquals(summary.contribution.contributedIssues, 2);
  assertEquals(summary.contribution.totalUserComments, 2);
  assertEquals(summary.highPriorityLabelIssues, 1);
  assertEquals(summary.topLabels[0].label, "bug");
});

Deno.test("buildRunReport applies deterministic impact scoring, ordering, and sections", async () => {
  const report = await buildRunReport(
    {
      github: [{
        id: 3,
        number: 99,
        title: "GH issue",
        state: "closed",
        body: "Critical customer fix",
        created_at: "2026-02-01T00:00:00Z",
        updated_at: "2026-02-16T22:30:00Z",
        user: { login: "mock.user" },
        assignees: [{ login: "mock.user" }],
        labels: [{ name: "p1" }, { name: "customer" }],
        comments: 3,
        notes: [
          { id: 1, user: { login: "mock.user" } },
          { id: 2, user: { login: "mock.user" } },
          { id: 3, user: { login: "teammate" } },
        ],
      }, {
        id: 4,
        number: 100,
        title: "Secondary",
        state: "open",
        created_at: "2026-02-01T00:00:00Z",
        updated_at: "2026-02-10T10:00:00Z",
        user: { login: "teammate" },
        assignees: [{ login: "teammate" }],
        labels: [{ name: "maintenance" }],
        comments: 0,
        notes: [],
      }],
    },
    {
      startDate: "2026-02-01T00:00:00Z",
      endDate: "2026-02-16T23:59:59Z",
      fetchMode: "all_contributions",
      reportProfile: "activity_retro",
      reportFormat: "both",
      aiNarrative: "off",
      aiModel: "gpt-4o-mini",
      usernames: {
        github: "mock.user",
      },
    },
  );

  assertEquals(report.normalizedIssues.length, 2);
  assertEquals(report.normalizedIssues[0].key, "GH-99");

  // completed (40) + authored (15) + assigned (10) + comments 2*2 (4) + high-impact label (12) + recent update (8)
  assertEquals(report.normalizedIssues[0].impactScore, 89);
  assertEquals(report.normalizedIssues[1].impactScore, 20);

  assertStringIncludes(report.markdown, "## Top Activity Highlights");
  assertStringIncludes(report.markdown, "## Collaboration Highlights");
  assertStringIncludes(report.markdown, "## Risks and Follow-ups");
  assertStringIncludes(report.markdown, "## Weekly Activity Talking Points");
  assertStringIncludes(report.markdown, "## Appendix");
  assertStringIncludes(report.markdown, "## Coverage");
  assertEquals(report.markdown.includes("## Comparison"), false);

  assertStringIncludes(report.html, "Activity Report");
  assertStringIncludes(report.html, "Top Activity Highlights");
  assertStringIncludes(report.html, "Collaboration Highlights");
  assertStringIncludes(report.html, "Risks and Follow-ups");
  assertStringIncludes(report.html, "Talking Points");
  assertStringIncludes(report.html, "Appendix");
  assertStringIncludes(report.html, "Impact Legend");
  assertStringIncludes(report.html, "GH-99");
  assertEquals(report.html.includes("Week-over-week"), false);
  assertEquals(report.html.includes("vs previous"), false);
  assertEquals(report.coverage.sourceMode, "report");
  assertEquals(report.coverage.totalProviderCount, 3);

  // context carried through for file naming
  assertEquals(report.context.startDate, "2026-02-01T00:00:00Z");
  assertEquals(report.context.endDate, "2026-02-16T23:59:59Z");
});

Deno.test("buildRunReport is current-window only and ignores previous-window options", async () => {
  const report = await buildRunReport(
    {
      github: [{
        id: 10,
        number: 10,
        title: "Current issue",
        state: "closed",
        created_at: "2026-02-10T00:00:00Z",
        updated_at: "2026-02-16T22:30:00Z",
        user: { login: "mock.user" },
        assignees: [{ login: "mock.user" }],
        labels: [{ name: "p1" }],
        comments: 4,
        notes: [{ id: 1, user: { login: "mock.user" } }],
      }],
    },
    {
      startDate: "2026-02-10T00:00:00Z",
      endDate: "2026-02-16T23:59:59Z",
      fetchMode: "all_contributions",
      reportProfile: "activity_retro",
      reportFormat: "both",
      aiNarrative: "off",
      aiModel: "gpt-4o-mini",
      sourceMode: "fetch",
      usernames: { github: "mock.user" },
    },
    {
      diagnostics: {
        sourceMode: "fetch",
        requestedProviders: ["github"],
        runResults: [{ provider: "github", status: "success", issueCount: 1 }],
      },
    },
  );

  assertNotEquals(report.normalizedIssues[0].impactScore, 0);
  assertEquals(report.markdown.includes("## Comparison"), false);
  assertEquals(report.html.includes("Previous"), false);
  assertEquals(report.html.includes("vs previous"), false);
  assertEquals(report.coverage.connectedProviderCount, 1);
  assertEquals(report.coverage.partialFailures, 0);
});

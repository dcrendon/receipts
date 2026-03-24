import { assertEquals } from "@std/assert";
import {
  buildReportSummary,
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
      commentTimestamps: [],
      description: "",
      descriptionSnippet: "",
      project: "gitlab",
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
      commentTimestamps: [],
      description: "",
      descriptionSnippet: "",
      project: "org/repo",
    },
  ]);

  assertEquals(summary.totalIssues, 2);
  assertEquals(summary.byProvider.gitlab, 1);
  assertEquals(summary.byProvider.github, 1);
  assertEquals(summary.byBucket.active, 1);
  assertEquals(summary.byBucket.completed, 1);
  assertEquals(summary.contribution.contributedIssues, 2);
  assertEquals(summary.contribution.totalUserComments, 2);
});

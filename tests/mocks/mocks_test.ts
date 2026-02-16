import { assertEquals, assertRejects } from "@std/assert";
import { loadMockIssues } from "../../providers/mocks.ts";

Deno.test("loadMockIssues loads GitLab fixture array", async () => {
  const issues = await loadMockIssues("gitlab");

  assertEquals(Array.isArray(issues), true);
  assertEquals(issues.length > 0, true);
});

Deno.test("loadMockIssues loads GitHub fixture array", async () => {
  const issues = await loadMockIssues("github");

  assertEquals(Array.isArray(issues), true);
  assertEquals(issues.length > 0, true);
});

Deno.test("loadMockIssues throws for missing fixture path", async () => {
  await assertRejects(() => loadMockIssues("jira", "not-a-real-directory"));
});

import { assertEquals } from "@std/assert";
import { getDefaultOutFile, normalizeChoice } from "../../tui.ts";

Deno.test("getDefaultOutFile returns provider defaults", () => {
  assertEquals(getDefaultOutFile("gitlab"), "gitlab_issues.json");
  assertEquals(getDefaultOutFile("jira"), "jira_issues.json");
  assertEquals(getDefaultOutFile("github"), "github_issues.json");
  assertEquals(getDefaultOutFile("all"), "issues.json");
});

Deno.test("normalizeChoice validates and normalizes input", () => {
  const allowed = ["gitlab", "jira", "github"] as const;
  assertEquals(normalizeChoice("GitHub", allowed), "github");
  assertEquals(normalizeChoice(" jira ", allowed), "jira");
  assertEquals(normalizeChoice("invalid", allowed), undefined);
});

import { assertEquals } from "@std/assert";
import { getDefaultOutFile, normalizeChoice } from "../../config/tui.ts";

Deno.test("getDefaultOutFile returns provider defaults", () => {
  assertEquals(getDefaultOutFile("gitlab"), "output/gitlab_issues.json");
  assertEquals(getDefaultOutFile("jira"), "output/jira_issues.json");
  assertEquals(getDefaultOutFile("github"), "output/github_issues.json");
  assertEquals(getDefaultOutFile("all"), "output/issues.json");
});

Deno.test("normalizeChoice validates and normalizes input", () => {
  const allowed = ["gitlab", "jira", "github"] as const;
  assertEquals(normalizeChoice("GitHub", allowed), "github");
  assertEquals(normalizeChoice(" jira ", allowed), "jira");
  assertEquals(normalizeChoice("invalid", allowed), undefined);
});

import { assertEquals } from "@std/assert";
import {
  formatProviderReadinessSummary,
  getDefaultOutFile,
  normalizeChoice,
  resolveAiWizardConfig,
} from "../../config/tui.ts";
import { Config } from "../../shared/types.ts";

const baseConfig = (overrides: Partial<Config> = {}): Config => ({
  provider: "all",
  outFile: "output/issues.json",
  timeRange: "week",
  fetchMode: "all_contributions",
  reportProfile: "activity_retro",
  reportFormat: "html",
  aiNarrative: "auto",
  aiModel: "gpt-4o-mini",
  ...overrides,
});

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
  assertEquals(normalizeChoice("", allowed), undefined);
  assertEquals(normalizeChoice("invalid", allowed), undefined);
});

Deno.test("formatProviderReadinessSummary marks missing providers as skipping", () => {
  const lines = formatProviderReadinessSummary(
    baseConfig({
      provider: "all",
      gitlabPAT: "token",
      gitlabURL: "https://gitlab.com",
      jiraPAT: "token",
      githubPAT: "token",
      githubURL: "https://api.github.com",
      githubUsername: "user",
    }),
  );

  assertEquals(lines[0], "Provider readiness:");
  assertEquals(
    lines.some((line) => line.includes("GitLab") && line.includes("| ready")),
    true,
  );
  assertEquals(
    lines.some((line) =>
      line.includes("Jira") &&
      line.includes("| skipping")
    ),
    true,
  );
  assertEquals(
    lines.some((line) => line.includes("GitHub") && line.includes("| ready")),
    true,
  );
});

Deno.test("resolveAiWizardConfig disables AI when OPENAI_API_KEY is missing", () => {
  const decision = resolveAiWizardConfig(
    baseConfig({
      openaiApiKey: undefined,
      aiModel: "gpt-4o-mini",
    }),
  );

  assertEquals(decision.aiNarrative, "off");
  assertEquals(decision.aiModel, "gpt-4o-mini");
  assertEquals(decision.shouldPromptForModel, false);
  assertEquals(decision.disabledReason, "OPENAI_API_KEY not set");
});

Deno.test("resolveAiWizardConfig prompts for model when OPENAI_API_KEY is present", () => {
  const decision = resolveAiWizardConfig(
    baseConfig({
      openaiApiKey: "secret",
      aiModel: "gpt-4o-mini",
    }),
  );

  assertEquals(decision.aiNarrative, "auto");
  assertEquals(decision.aiModel, "gpt-4o-mini");
  assertEquals(decision.shouldPromptForModel, true);
  assertEquals(decision.disabledReason, undefined);
});

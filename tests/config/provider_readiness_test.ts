import { assertEquals } from "@std/assert";
import {
  getMissingFieldsForProvider,
  getProviderReadiness,
  isProviderRunnable,
  PROVIDER_REQUIREMENTS,
} from "../../config/provider_readiness.ts";
import { Config } from "../../shared/types.ts";

const baseConfig = (overrides: Partial<Config> = {}): Config => ({
  provider: "all",
  outFile: "output/issues.json",
  timeRange: "week",
  gitlabPAT: "gitlab-token",
  gitlabURL: "https://gitlab.com",
  jiraPAT: "jira-token",
  jiraURL: "https://jira.example.com",
  jiraUsername: "jira-user",
  githubPAT: "github-token",
  githubURL: "https://api.github.com",
  githubUsername: "github-user",
  ...overrides,
});

Deno.test("PROVIDER_REQUIREMENTS tracks required credential fields", () => {
  assertEquals(PROVIDER_REQUIREMENTS.gitlab, ["gitlabPAT", "gitlabURL"]);
  assertEquals(PROVIDER_REQUIREMENTS.jira, [
    "jiraPAT",
    "jiraURL",
    "jiraUsername",
  ]);
  assertEquals(PROVIDER_REQUIREMENTS.github, [
    "githubPAT",
    "githubURL",
    "githubUsername",
  ]);
});

Deno.test("getProviderReadiness returns runnable providers when complete", () => {
  const readiness = getProviderReadiness(baseConfig());
  assertEquals(readiness.selectedProviders, ["gitlab", "jira", "github"]);
  assertEquals(readiness.runnableProviders, ["gitlab", "jira", "github"]);
  assertEquals(readiness.missingByProvider.gitlab, undefined);
});

Deno.test("getProviderReadiness reports missing credentials", () => {
  const readiness = getProviderReadiness(
    baseConfig({
      provider: "all",
      jiraURL: undefined,
      jiraUsername: undefined,
    }),
  );

  assertEquals(readiness.runnableProviders.includes("jira"), false);
  assertEquals(readiness.missingByProvider.jira, ["jiraURL", "jiraUsername"]);
});

Deno.test("getProviderReadiness with no credentials has no runnable providers", () => {
  const readiness = getProviderReadiness(
    baseConfig({
      gitlabPAT: undefined,
      gitlabURL: undefined,
      jiraPAT: undefined,
      jiraURL: undefined,
      jiraUsername: undefined,
      githubPAT: undefined,
      githubURL: undefined,
      githubUsername: undefined,
    }),
  );

  assertEquals(readiness.runnableProviders.length, 0);
  assertEquals(Object.keys(readiness.missingByProvider).length, 3);
});

Deno.test("isProviderRunnable combines selection and credential completeness", () => {
  const config = baseConfig({ provider: "jira", jiraUsername: undefined });
  assertEquals(isProviderRunnable(config, "jira"), false);
  assertEquals(isProviderRunnable(config, "gitlab"), false);
});

Deno.test("getMissingFieldsForProvider returns missing field list", () => {
  const missing = getMissingFieldsForProvider(
    baseConfig({ githubURL: "", githubUsername: undefined }),
    "github",
  );
  assertEquals(missing, ["githubURL", "githubUsername"]);
});

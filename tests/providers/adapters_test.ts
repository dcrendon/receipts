import { assertEquals } from "@std/assert";
import { Config } from "../../shared/types.ts";
import { GitHubAdapter } from "../../providers/github_adapter.ts";
import { GitLabAdapter } from "../../providers/gitlab_adapter.ts";
import { JiraAdapter } from "../../providers/jira_adapter.ts";

const baseConfig = (overrides: Partial<Config> = {}): Config => {
  return {
    provider: "gitlab",
    outFile: "issues.json",
    timeRange: "week",
    fetchMode: "all_contributions",
    useMockData: false,
    ...overrides,
  };
};

Deno.test("GitLabAdapter canRun/getOutFile follow provider selection", () => {
  const adapter = new GitLabAdapter();
  assertEquals(adapter.canRun(baseConfig({ provider: "gitlab" })), true);
  assertEquals(adapter.canRun(baseConfig({ provider: "all" })), true);
  assertEquals(adapter.canRun(baseConfig({ provider: "jira" })), false);
  assertEquals(
    adapter.getOutFile(baseConfig({ provider: "all", outFile: "custom.json" })),
    "output/gitlab_issues.json",
  );
});

Deno.test("JiraAdapter canRun/getOutFile follow provider selection", () => {
  const adapter = new JiraAdapter();
  assertEquals(adapter.canRun(baseConfig({ provider: "jira" })), true);
  assertEquals(adapter.canRun(baseConfig({ provider: "all" })), true);
  assertEquals(adapter.canRun(baseConfig({ provider: "gitlab" })), false);
  assertEquals(
    adapter.getOutFile(baseConfig({ provider: "all", outFile: "custom.json" })),
    "output/jira_issues.json",
  );
});

Deno.test("GitHubAdapter canRun/getOutFile follow provider selection", () => {
  const adapter = new GitHubAdapter();
  assertEquals(adapter.canRun(baseConfig({ provider: "github" })), true);
  assertEquals(adapter.canRun(baseConfig({ provider: "all" })), true);
  assertEquals(adapter.canRun(baseConfig({ provider: "jira" })), false);
  assertEquals(
    adapter.getOutFile(baseConfig({ provider: "all", outFile: "custom.json" })),
    "output/github_issues.json",
  );
});

Deno.test("GitLabAdapter uses mock loader when mock mode is enabled", async () => {
  let usedMock = false;
  let usedLive = false;
  const adapter = new GitLabAdapter({
    loadMock: async () => {
      usedMock = true;
      return [{ id: "mock" }];
    },
    fetchLive: async () => {
      usedLive = true;
      return [];
    },
  });

  const data = await adapter.fetchIssues(
    baseConfig({ provider: "gitlab", useMockData: true }),
    {
      startDate: "2026-02-01T00:00:00.000Z",
      endDate: "2026-02-16T23:59:59.999Z",
    },
  );

  assertEquals(usedMock, true);
  assertEquals(usedLive, false);
  assertEquals(data.length, 1);
});

Deno.test("JiraAdapter uses live fetch when mock mode is disabled", async () => {
  let usedLive = false;
  let usedMock = false;
  const adapter = new JiraAdapter({
    loadMock: async () => {
      usedMock = true;
      return [];
    },
    fetchLive: async () => {
      usedLive = true;
      return [{ key: "LIVE-1" }];
    },
  });

  const data = await adapter.fetchIssues(
    baseConfig({
      provider: "jira",
      useMockData: false,
      jiraURL: "https://jira.example.com",
      jiraPAT: "token",
      jiraUsername: "mock.user",
    }),
    {
      startDate: "2026-02-01T00:00:00.000Z",
      endDate: "2026-02-16T23:59:59.999Z",
    },
  );

  assertEquals(usedLive, true);
  assertEquals(usedMock, false);
  assertEquals(data.length, 1);
});

Deno.test("GitHubAdapter uses live fetch when mock mode is disabled", async () => {
  let usedLive = false;
  let usedMock = false;
  const adapter = new GitHubAdapter({
    loadMock: async () => {
      usedMock = true;
      return [];
    },
    fetchLive: async () => {
      usedLive = true;
      return [{ number: 123 }];
    },
  });

  const data = await adapter.fetchIssues(
    baseConfig({
      provider: "github",
      useMockData: false,
      githubURL: "https://api.github.com",
      githubPAT: "token",
      githubUsername: "mock.user",
    }),
    {
      startDate: "2026-02-01T00:00:00.000Z",
      endDate: "2026-02-16T23:59:59.999Z",
    },
  );

  assertEquals(usedLive, true);
  assertEquals(usedMock, false);
  assertEquals(data.length, 1);
});

import { githubIssues } from "./github.ts";
import { loadMockIssues } from "./mocks.ts";
import { Config } from "../shared/types.ts";
import { DateWindow, ProviderAdapter } from "./types.ts";

type GitHubDeps = {
  fetchLive: typeof githubIssues;
  loadMock: typeof loadMockIssues;
};

export class GitHubAdapter implements ProviderAdapter {
  name: "github" = "github";
  #deps: GitHubDeps;

  constructor(deps?: Partial<GitHubDeps>) {
    this.#deps = {
      fetchLive: deps?.fetchLive ?? githubIssues,
      loadMock: deps?.loadMock ?? loadMockIssues,
    };
  }

  canRun(config: Config): boolean {
    return config.provider === "github" || config.provider === "all";
  }

  getOutFile(config: Config): string {
    return config.provider === "all"
      ? "output/github_issues.json"
      : config.outFile;
  }

  async fetchIssues(
    config: Config,
    dateWindow: DateWindow,
  ): Promise<unknown[]> {
    if (config.useMockData) {
      console.log("\nUsing GitHub mock fixture data.");
      return await this.#deps.loadMock("github", config.mockDataDir);
    }

    const headers = {
      "Authorization": `Bearer ${config.githubPAT}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    return await this.#deps.fetchLive(
      config.githubURL!,
      headers,
      config.githubUsername!,
      dateWindow.startDate,
      dateWindow.endDate,
      config.fetchMode,
    );
  }
}

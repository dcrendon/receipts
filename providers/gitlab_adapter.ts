import { gitlabIssues } from "./gitlab.ts";
import { loadMockIssues } from "./mocks.ts";
import { Config } from "../shared/types.ts";
import { DateWindow, ProviderAdapter } from "./types.ts";

type GitLabDeps = {
  fetchLive: typeof gitlabIssues;
  loadMock: typeof loadMockIssues;
};

export class GitLabAdapter implements ProviderAdapter {
  name: "gitlab" = "gitlab";
  #deps: GitLabDeps;

  constructor(deps?: Partial<GitLabDeps>) {
    this.#deps = {
      fetchLive: deps?.fetchLive ?? gitlabIssues,
      loadMock: deps?.loadMock ?? loadMockIssues,
    };
  }

  canRun(config: Config): boolean {
    return config.provider === "gitlab" || config.provider === "all";
  }

  getOutFile(config: Config): string {
    return config.provider === "all"
      ? "output/gitlab_issues.json"
      : config.outFile;
  }

  async fetchIssues(
    config: Config,
    dateWindow: DateWindow,
  ): Promise<unknown[]> {
    if (config.useMockData) {
      console.log("\nUsing GitLab mock fixture data.");
      return await this.#deps.loadMock("gitlab", config.mockDataDir);
    }

    const headers = {
      "PRIVATE-TOKEN": config.gitlabPAT!,
    };

    return await this.#deps.fetchLive(
      config.gitlabURL!,
      headers,
      dateWindow.startDate,
      dateWindow.endDate,
      config.fetchMode,
    );
  }
}

import { jiraIssues } from "./jira.ts";
import { loadMockIssues } from "./mocks.ts";
import { Config } from "../shared/types.ts";
import { DateWindow, ProviderAdapter } from "./types.ts";

type JiraDeps = {
  fetchLive: typeof jiraIssues;
  loadMock: typeof loadMockIssues;
};

export class JiraAdapter implements ProviderAdapter {
  name: "jira" = "jira";
  #deps: JiraDeps;

  constructor(deps?: Partial<JiraDeps>) {
    this.#deps = {
      fetchLive: deps?.fetchLive ?? jiraIssues,
      loadMock: deps?.loadMock ?? loadMockIssues,
    };
  }

  canRun(config: Config): boolean {
    return config.provider === "jira" || config.provider === "all";
  }

  getOutFile(config: Config): string {
    return config.provider === "all"
      ? "output/jira_issues.json"
      : config.outFile;
  }

  async fetchIssues(
    config: Config,
    dateWindow: DateWindow,
  ): Promise<unknown[]> {
    if (config.useMockData) {
      console.log("\nUsing Jira mock fixture data.");
      return await this.#deps.loadMock("jira", config.mockDataDir);
    }

    const headers = {
      "Authorization": `Bearer ${config.jiraPAT}`,
      "Content-Type": "application/json",
    };

    return await this.#deps.fetchLive(
      config.jiraURL!,
      headers,
      config.jiraUsername!,
      dateWindow.startDate,
      dateWindow.endDate,
      config.fetchMode,
    );
  }
}

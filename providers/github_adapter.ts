import { githubIssues } from "./github.ts";
import { Config } from "../shared/types.ts";
import { DateWindow, ProviderAdapter } from "./types.ts";
import { isProviderRunnable } from "../config/provider_readiness.ts";

type GitHubDeps = {
  fetchLive: typeof githubIssues;
};

export class GitHubAdapter implements ProviderAdapter {
  name: "github" = "github";
  #deps: GitHubDeps;

  constructor(deps?: Partial<GitHubDeps>) {
    this.#deps = {
      fetchLive: deps?.fetchLive ?? githubIssues,
    };
  }

  canRun(config: Config): boolean {
    return isProviderRunnable(config, "github");
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
    if (!config.githubPAT || !config.githubURL || !config.githubUsername) {
      throw new Error("GitHub provider config is incomplete.");
    }

    const headers = {
      "Authorization": `Bearer ${config.githubPAT}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    return await this.#deps.fetchLive(
      config.githubURL,
      headers,
      config.githubUsername,
      dateWindow.startDate,
      dateWindow.endDate,
    );
  }
}

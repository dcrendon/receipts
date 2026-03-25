import { GitLabAdapter } from "./gitlab_adapter.ts";
import { GitHubAdapter } from "./github_adapter.ts";
import { JiraAdapter } from "./jira_adapter.ts";
import { ProviderAdapter } from "./types.ts";

export const getProviderAdapters = (): ProviderAdapter[] => {
  return [new GitLabAdapter(), new JiraAdapter(), new GitHubAdapter()];
};

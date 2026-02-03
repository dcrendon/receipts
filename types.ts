export interface Config {
  gitlabPAT?: string;
  gitlabURL?: string;
  jiraPAT?: string;
  jiraURL?: string;
  jiraUsername?: string;
  outFile: string;
  timeRange: string;
  fetchMode: string;
  provider: "gitlab" | "jira" | "all";
  startDate?: string;
  endDate?: string;
  //   projectIDs: string[];
}

interface GitlabUser {
  id: number;
  username?: string;
  name?: string;
}

export interface GitlabIssue {
  id: number;
  iid: number;
  project_id: number;
  author: GitlabUser;
  assignees?: GitlabUser[];
  created_at: string;
  updated_at: string;
  notes?: any[];
  [key: string]: any;
}

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description: string;
    created: string;
    updated: string;
    assignee?: {
      accountId: string;
      displayName: string;
    };
    reporter?: {
      accountId: string;
      displayName: string;
    };
    status: {
      name: string;
    };
    [key: string]: unknown;
  };
  notes?: any[];
  [key: string]: unknown;
}

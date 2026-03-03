export type UnknownRecord = Record<string, unknown>;

export interface Config {
  gitlabPAT?: string;
  gitlabURL?: string;
  gitlabUsername?: string;
  jiraPAT?: string;
  jiraURL?: string;
  jiraUsername?: string;
  githubPAT?: string;
  githubURL?: string;
  githubUsername?: string;
  aiModel?: string;
  openaiApiKey?: string;
  outFile: string;
  timeRange: string;
  provider: "gitlab" | "jira" | "github" | "all";
  startDate?: string;
  endDate?: string;
}

interface GitlabUser {
  id: number;
  username?: string;
  name?: string;
  [key: string]: unknown;
}

export interface GitlabNote {
  id?: number;
  author?: GitlabUser;
  body?: string;
  [key: string]: unknown;
}

export interface GitlabIssue {
  id: number;
  iid: number;
  project_id: number;
  author: GitlabUser;
  assignees?: GitlabUser[];
  created_at: string;
  updated_at: string;
  notes?: GitlabNote[];
  [key: string]: unknown;
}

interface JiraUser {
  accountId?: string;
  displayName?: string;
  name?: string;
  emailAddress?: string;
  [key: string]: unknown;
}

export interface JiraComment {
  id?: string;
  author?: JiraUser;
  body?: unknown;
  [key: string]: unknown;
}

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description: string;
    created: string;
    updated: string;
    assignee?: JiraUser;
    reporter?: JiraUser;
    status: {
      name: string;
    };
    [key: string]: unknown;
  };
  notes?: JiraComment[];
  [key: string]: unknown;
}

interface GitHubActor {
  login?: string;
  [key: string]: unknown;
}

interface GitHubLabel {
  name?: string;
  [key: string]: unknown;
}

export interface GitHubComment {
  id?: number;
  body?: string;
  user?: GitHubActor;
  [key: string]: unknown;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: string;
  created_at: string;
  updated_at: string;
  comments?: number;
  labels?: GitHubLabel[];
  assignees?: GitHubActor[];
  milestone?: { title?: string } | null;
  user?: GitHubActor;
  comments_url?: string;
  repository_url?: string;
  html_url?: string;
  body?: string;
  notes?: GitHubComment[];
  metadata?: {
    repository?: string;
    labelNames?: string[];
    assigneeLogins?: string[];
    milestoneTitle?: string | null;
    commentCount?: number;
  };
  [key: string]: unknown;
}

import { requestJsonWithRetry } from "./http_client.ts";
import { GitHubComment, GitHubIssue, UnknownRecord } from "../shared/types.ts";

interface GitHubSearchResponse {
  total_count?: number;
  items?: GitHubIssue[];
}

const escapeGitHubValue = (value: string): string => {
  return value.replace(/"/g, '\\"');
};

const isoDateOnly = (value: string): string => value.split("T")[0];

const baseApiUrl = (githubURL: string): string =>
  githubURL.endsWith("/") ? githubURL : `${githubURL}/`;

const getPaginatedSearchResults = async (
  githubURL: string,
  headers: Record<string, string>,
  query: string,
): Promise<GitHubIssue[]> => {
  const allIssues: GitHubIssue[] = [];
  const perPage = 100;
  const baseURL = baseApiUrl(githubURL);

  for (let page = 1;; page++) {
    const searchUrl = new URL("search/issues", baseURL);
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("page", String(page));
    searchUrl.searchParams.set("per_page", String(perPage));

    const response = await requestJsonWithRetry<GitHubSearchResponse>(
      searchUrl.toString(),
      { headers, method: "GET" },
      "GitHub search",
    );

    const items = response.items ?? [];
    if (!items.length) {
      break;
    }

    allIssues.push(...items);

    const totalCount = response.total_count ?? 0;
    if (allIssues.length >= totalCount) {
      break;
    }
  }

  return allIssues;
};

const getIssueComments = async (
  headers: Record<string, string>,
  commentsURL: string,
): Promise<GitHubComment[]> => {
  const allComments: GitHubComment[] = [];
  const perPage = 100;

  for (let page = 1;; page++) {
    const url = new URL(commentsURL);
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(perPage));

    const comments = await requestJsonWithRetry<GitHubComment[]>(
      url.toString(),
      { headers, method: "GET" },
      "GitHub comments",
    );

    if (!comments.length) {
      break;
    }

    allComments.push(...comments);
  }

  return allComments;
};

const removeNulls = (obj: unknown): unknown => {
  if (Array.isArray(obj)) {
    return obj
      .map((v) => removeNulls(v))
      .filter((v) => v !== null && v !== undefined);
  }

  if (typeof obj === "object" && obj !== null) {
    const newObj: UnknownRecord = {};
    for (const [key, currentValue] of Object.entries(obj as UnknownRecord)) {
      const val = removeNulls(currentValue);
      if (val !== null && val !== undefined) {
        newObj[key] = val;
      }
    }
    return newObj;
  }

  return obj;
};

const buildQuery = (
  username: string,
  startDate: string,
  endDate: string,
): string => {
  const safeUser = escapeGitHubValue(username);
  const from = isoDateOnly(startDate);
  const to = isoDateOnly(endDate);
  return `type:issue involves:${safeUser} updated:${from}..${to}`;
};

const dedupeIssues = (issues: GitHubIssue[]): GitHubIssue[] => {
  const byId = new Map<number, GitHubIssue>();
  for (const issue of issues) {
    byId.set(issue.id, issue);
  }
  return [...byId.values()];
};

const enrichIssue = async (
  issue: GitHubIssue,
  headers: Record<string, string>,
): Promise<GitHubIssue> => {
  const commentCount = issue.comments ?? 0;
  const commentsURL = typeof issue.comments_url === "string"
    ? issue.comments_url
    : undefined;

  const notes = commentCount > 0 && commentsURL
    ? await getIssueComments(headers, commentsURL)
    : [];

  issue.notes = notes;
  issue.metadata = {
    repository: typeof issue.repository_url === "string"
      ? issue.repository_url.split("/").slice(-2).join("/")
      : undefined,
    labelNames: (issue.labels ?? [])
      .map((label) => label?.name)
      .filter((name): name is string => Boolean(name)),
    assigneeLogins: (issue.assignees ?? [])
      .map((assignee) => assignee?.login)
      .filter((login): login is string => Boolean(login)),
    milestoneTitle: issue.milestone?.title ?? null,
    commentCount,
  };

  return issue;
};

export const githubIssues = async (
  githubURL: string,
  headers: Record<string, string>,
  username: string,
  startDate: string,
  endDate: string,
) => {
  const query = buildQuery(username, startDate, endDate);
  const rawIssues = await getPaginatedSearchResults(githubURL, headers, query);
  const issues = dedupeIssues(rawIssues);

  if (!issues.length) {
    return [];
  }

  const enriched = await Promise.all(
    issues.map((issue) => enrichIssue(issue, headers)),
  );

  return removeNulls(enriched) as GitHubIssue[];
};

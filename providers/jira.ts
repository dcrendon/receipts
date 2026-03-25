import { requestJsonWithRetry } from "./http_client.ts";
import { JiraComment, JiraIssue, UnknownRecord } from "../shared/types.ts";

const getPaginatedResults = async (
  jiraURL: string,
  headers: Record<string, string>,
  jql: string,
): Promise<JiraIssue[]> => {
  let startAt = 0;
  const maxResults = 100;
  const allIssues: JiraIssue[] = [];

  const baseURL = jiraURL.endsWith("/") ? jiraURL : `${jiraURL}/`;
  const searchURL = new URL("rest/api/2/search", baseURL);

  while (true) {
    searchURL.searchParams.set("jql", jql);
    searchURL.searchParams.set("startAt", String(startAt));
    searchURL.searchParams.set("maxResults", String(maxResults));

    const data = await requestJsonWithRetry<{
      issues?: JiraIssue[];
      total?: number;
    }>(
      searchURL.toString(),
      {
        headers,
        method: "GET",
      },
      "Jira search",
    );
    const issues = data.issues ?? [];

    if (!issues.length) {
      break;
    }

    allIssues.push(...issues);
    startAt += issues.length;

    if (startAt >= (data.total ?? 0)) {
      break;
    }
  }

  return allIssues;
};

const getIssueComments = async (
  jiraURL: string,
  headers: Record<string, string>,
  issueKey: string,
): Promise<JiraComment[]> => {
  const baseURL = jiraURL.endsWith("/") ? jiraURL : `${jiraURL}/`;
  const commentsURL = new URL(`rest/api/2/issue/${issueKey}/comment`, baseURL);
  commentsURL.searchParams.set("maxResults", "100");

  try {
    const data = await requestJsonWithRetry<{ comments?: JiraComment[] }>(
      commentsURL.toString(),
      {
        headers,
        method: "GET",
      },
      `Jira comments ${issueKey}`,
    );
    return data.comments ?? [];
  } catch (error) {
    console.error(`Error fetching comments for ${issueKey}: ${error}`);
    return [];
  }
};

const escapeJQL = (str: string) => str.replace(/"/g, '\\"');
const isoDateOnly = (value: string) => value.split("T")[0];

const buildJql = (
  username: string,
  startDate: string,
  endDate: string,
): string => {
  const safeUser = escapeJQL(username);
  const from = isoDateOnly(startDate);
  const to = isoDateOnly(endDate);
  return `(assignee = "${safeUser}" OR reporter = "${safeUser}" OR watcher = "${safeUser}") AND updated >= "${from}" AND updated <= "${to}"`;
};

const matchesUser = (user: unknown, username: string): boolean => {
  if (!user || typeof user !== "object") return false;
  const asRecord = user as UnknownRecord;
  return (
    asRecord.name === username ||
    asRecord.accountId === username ||
    asRecord.displayName === username ||
    asRecord.emailAddress === username
  );
};

const isContributor = (
  issue: JiraIssue,
  comments: JiraComment[],
  username: string,
): boolean => {
  if (matchesUser(issue.fields?.assignee, username)) return true;
  if (matchesUser(issue.fields?.reporter, username)) return true;
  return comments.some((comment) => matchesUser(comment.author, username));
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

export const jiraIssues = async (
  jiraURL: string,
  headers: Record<string, string>,
  username: string,
  startDate: string,
  endDate: string,
) => {
  const jql = buildJql(username, startDate, endDate);

  const issues = await getPaginatedResults(jiraURL, headers, jql);

  if (!issues.length) return [];

  const finalIssues: JiraIssue[] = [];

  for (const issue of issues) {
    const comments = await getIssueComments(jiraURL, headers, issue.key);
    issue.notes = comments;

    if (isContributor(issue, comments, username)) {
      finalIssues.push(issue);
    }
  }

  return removeNulls(finalIssues) as JiraIssue[];
};

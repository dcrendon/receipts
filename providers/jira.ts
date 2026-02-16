import { requestJsonWithRetry } from "./http_client.ts";

const getPaginatedResults = async (
  jiraURL: string,
  headers: Record<string, string>,
  jql: string,
): Promise<any[]> => {
  let startAt = 0;
  const maxResults = 100;
  const allIssues: any[] = [];

  const baseURL = jiraURL.endsWith("/") ? jiraURL : `${jiraURL}/`;
  const searchURL = new URL("rest/api/2/search", baseURL);

  while (true) {
    searchURL.searchParams.set("jql", jql);
    searchURL.searchParams.set("startAt", String(startAt));
    searchURL.searchParams.set("maxResults", String(maxResults));

    const data = await requestJsonWithRetry<{ issues?: any[]; total?: number }>(
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
): Promise<any[]> => {
  const baseURL = jiraURL.endsWith("/") ? jiraURL : `${jiraURL}/`;
  const commentsURL = new URL(`rest/api/2/issue/${issueKey}/comment`, baseURL);
  commentsURL.searchParams.set("maxResults", "100");

  try {
    const data = await requestJsonWithRetry<{ comments?: any[] }>(
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
  fetchMode: string,
): string => {
  const safeUser = escapeJQL(username);
  const from = isoDateOnly(startDate);
  const to = isoDateOnly(endDate);

  if (fetchMode === "my_issues") {
    return `(assignee = "${safeUser}" OR reporter = "${safeUser}") AND created >= "${from}" AND created <= "${to}"`;
  }

  if (fetchMode === "all_contributions") {
    return `(assignee = "${safeUser}" OR reporter = "${safeUser}" OR watcher = "${safeUser}") AND updated >= "${from}" AND updated <= "${to}"`;
  }

  throw new Error(`Invalid fetch mode: ${fetchMode}`);
};

const matchesUser = (user: any, username: string): boolean => {
  if (!user) return false;
  return (
    user.name === username ||
    user.accountId === username ||
    user.displayName === username ||
    user.emailAddress === username
  );
};

const isContributor = (
  issue: any,
  comments: any[],
  username: string,
): boolean => {
  if (matchesUser(issue.fields?.assignee, username)) return true;
  if (matchesUser(issue.fields?.reporter, username)) return true;
  return comments.some((comment) => matchesUser(comment.author, username));
};

const removeNulls = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj
      .map((v) => removeNulls(v))
      .filter((v) => v !== null && v !== undefined);
  }

  if (typeof obj === "object" && obj !== null) {
    const newObj: any = {};

    for (const key in obj) {
      const val = removeNulls(obj[key]);
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
  fetchMode: string,
) => {
  const jql = buildJql(username, startDate, endDate, fetchMode);

  console.log("\nFetching Jira issues...");
  console.log(`JQL: ${jql}`);

  const issues = await getPaginatedResults(jiraURL, headers, jql);

  console.log(`Initial fetch: ${issues.length} issues.`);
  if (!issues.length) return [];

  console.log("\nFetching comments and filtering...");

  const includeAllFetchedIssues = fetchMode === "my_issues";
  const finalIssues: any[] = [];

  for (const issue of issues) {
    const comments = await getIssueComments(jiraURL, headers, issue.key);
    issue.notes = comments;

    if (includeAllFetchedIssues || isContributor(issue, comments, username)) {
      finalIssues.push(issue);
    }
  }

  console.log(`Total issues after processing: ${finalIssues.length}`);
  return removeNulls(finalIssues);
};

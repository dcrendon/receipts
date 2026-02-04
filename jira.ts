import { promptExit } from "./config.ts";

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
    try {
      searchURL.searchParams.set("jql", jql);
      searchURL.searchParams.set("startAt", String(startAt));
      searchURL.searchParams.set("maxResults", String(maxResults));

      const response = await fetch(searchURL.toString(), {
        headers,
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch Jira issues: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();
      const issues = data.issues || [];

      if (issues.length === 0) {
        break;
      }

      allIssues.push(...issues);

      startAt += issues.length;
      if (startAt >= (data.total || 0)) {
        break;
      }
    } catch (error) {
      console.error(`${error}`);
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

  const commentsURL = new URL(
    `rest/api/2/issue/${issueKey}/comment`,
    baseURL,
  );

  commentsURL.searchParams.set("maxResults", "100");

  try {
    const response = await fetch(commentsURL.toString(), {
      headers,
      method: "GET",
    });

    if (!response.ok) {
      console.error(
        `Failed to fetch comments for ${issueKey}: ${response.statusText}`,
      );
      return [];
    }

    const data = await response.json();

    return data.comments || [];
  } catch (error) {
    console.error(`Error fetching comments for ${issueKey}: ${error}`);

    return [];
  }
};

// Simple sanitizer for JQL string values
const escapeJQL = (str: string) => {
  return str.replace(/"/g, '\\"');
};

const removeNulls = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj
      .map((v) => removeNulls(v))
      .filter((v) => v !== null && v !== undefined);
  } else if (typeof obj === "object" && obj !== null) {
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
  const formatDate = (d: string) => d.split("T")[0];

  const jqlStart = formatDate(startDate);

  const jqlEnd = formatDate(endDate);

  const safeUser = escapeJQL(username);

  let jql = "";

  if (fetchMode === "my_issues") {
    jql =
      `(assignee = "${safeUser}" OR reporter = "${safeUser}") AND created >= "${jqlStart}" AND created <= "${jqlEnd}"`;
  } else if (fetchMode === "all_contributions") {
    jql =
      `(assignee = "${safeUser}" OR reporter = "${safeUser}" OR watcher = "${safeUser}") AND updated >= "${jqlStart}" AND updated <= "${jqlEnd}"`;
  } else {
    promptExit(`Invalid fetch mode: ${fetchMode}`, 1);
  }

  console.log(`\nFetching Jira issues...`);

  console.log(`JQL: ${jql}`);

  const issues = await getPaginatedResults(jiraURL, headers, jql);

  console.log(`Initial fetch: ${issues.length} issues.`);

  if (issues.length === 0) {
    return [];
  }

  console.log(`\nFetching comments and filtering...`);

  const finalIssues: any[] = [];

  for (const issue of issues) {
    const comments = await getIssueComments(jiraURL, headers, issue.key);

    // Attach comments to the issue object, normalizing to 'notes' to match GitLab output structure
    issue.notes = comments;

    if (fetchMode === "my_issues") {
      finalIssues.push(issue);
    } else if (fetchMode === "all_contributions") {
      let isContributor = false;

      const matchesUser = (user: any) => {
        if (!user) return false;
        return (
          user.name === username ||
          user.accountId === username ||
          user.displayName === username ||
          user.emailAddress === username
        );
      };

      if (matchesUser(issue.fields?.assignee)) {
        isContributor = true;
      } else if (matchesUser(issue.fields?.reporter)) {
        isContributor = true;
      } else {
        for (const comment of comments) {
          if (matchesUser(comment.author)) {
            isContributor = true;
            break;
          }
        }
      }

      if (isContributor) {
        finalIssues.push(issue);
      }
    }
  }

  console.log(`Total issues after processing: ${finalIssues.length}`);

  return removeNulls(finalIssues);
};

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

  let jql = "";
  if (fetchMode === "my_issues") {
    jql = `(assignee = "${username}" OR reporter = "${username}") AND created >= "${jqlStart}" AND created <= "${jqlEnd}"`;
  } else if (fetchMode === "all_contributions") {
    jql = `(assignee = "${username}" OR reporter = "${username}" OR watcher = "${username}") AND updated >= "${jqlStart}" AND updated <= "${jqlEnd}"`;
  } else {
    promptExit(`Invalid fetch mode: ${fetchMode}`, 1);
  }

  console.log(`\nFetching Jira issues...`);
  console.log(`JQL: ${jql}`);

  const issues = await getPaginatedResults(jiraURL, headers, jql);

  console.log(`Fetched ${issues.length} issues.`);

  if (issues.length === 0) {
    promptExit("\nNo issues found to process. Exiting.", 0);
  }

  return issues;
};
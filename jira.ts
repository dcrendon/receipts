const jira1PAT = Deno.env.get("JIRA_PAT");
const jiraURL = Deno.env.get("JIRA_URL");

if (!jira1PAT) {
  throw new Error("JIRA_PAT is not set in environment variables");
}

if (!jiraURL) {
  throw new Error("JIRA_URL is not set in environment variables");
}

const getUserIssues = async (username: string) => {
  const resp = await fetch(
    `${jiraURL}search?jql=assignee=${username}+AND+statusCategory!=Done`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${jira1PAT}`,
      },
    },
  );
  if (!resp.ok) {
    throw new Error(
      `Failed to fetch issues for user ${username}: ${resp.statusText}`,
    );
  }
  const data = await resp.json();
  return data;
};

const issues = await getUserIssues("dcrendon");
console.log(issues);

import { generateConfig, promptExit } from "./config.ts";
import { getDateRange } from "./dates.ts";
import { gitlabIssues } from "./gitlab.ts";
import { jiraIssues } from "./jira.ts";

const main = async () => {
  const config = await generateConfig();
  const { startDate, endDate } = getDateRange(config);

  if (config.provider === "gitlab" || config.provider === "all") {
    const headers = {
      "PRIVATE-TOKEN": config.gitlabPAT!,
    };
    const outFile = config.provider === "all"
      ? "gitlab_issues.json"
      : config.outFile;

    const issues = await gitlabIssues(
      config.gitlabURL!,
      headers,
      startDate,
      endDate,
      config.fetchMode,
    );

    if (!issues.length) {
      console.log("\nNo GitLab issues found for the specified criteria.");
    } else {
      await Deno.writeTextFile(
        outFile,
        JSON.stringify(issues, null, 2),
      );
      console.log(`\nGitLab issue data written to ${outFile}`);
    }
  }

  if (config.provider === "jira" || config.provider === "all") {
    const headers = {
      "Authorization": `Bearer ${config.jiraPAT}`,
      "Content-Type": "application/json",
    };
    const outFile = config.provider === "all"
      ? "jira_issues.json"
      : config.outFile;

    const issues = await jiraIssues(
      config.jiraURL!,
      headers,
      config.jiraUsername!,
      startDate,
      endDate,
      config.fetchMode,
    );

    if (!issues.length) {
      console.log("\nNo Jira issues found for the specified criteria.");
    } else {
      await Deno.writeTextFile(
        outFile,
        JSON.stringify(issues, null, 2),
      );
      console.log(`\nJira issue data written to ${outFile}`);
    }
  }

  promptExit("Process completed successfully.", 0);
};

if (import.meta.main) {
  main();
}

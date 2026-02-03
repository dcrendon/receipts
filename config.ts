import { parseArgs, promptSecret } from "@std/cli";
import { load } from "@std/dotenv";
import { Config } from "./types.ts";

export const promptExit = (message: string | null, exitCode: number): never => {
  if (message) {
    console.log(message);
  }
  prompt("\nPress Enter to close...");
  Deno.exit(exitCode);
};

const checkENV = async (): Promise<Partial<Config>> => {
  await load({ export: true });
  const gitlabPAT = Deno.env.get("GITLAB_PAT");
  const gitlabURL = Deno.env.get("GITLAB_URL");
  const jiraPAT = Deno.env.get("JIRA_PAT");
  const jiraURL = Deno.env.get("JIRA_URL");
  const jiraUsername = Deno.env.get("JIRA_USERNAME");
  const outFile = Deno.env.get("OUT_FILE");
  const timeRange = Deno.env.get("TIME_RANGE");
  const fetchMode = Deno.env.get("FETCH_MODE");
  const startDate = Deno.env.get("START_DATE");
  const endDate = Deno.env.get("END_DATE");
  const provider = Deno.env.get("PROVIDER") as "gitlab" | "jira" | "all" | undefined;
  // const projectIDs = Deno.env.get("PROJECT_IDS")?.split(",");
  const envParams: Partial<Config> = {
    gitlabPAT,
    gitlabURL,
    jiraPAT,
    jiraURL,
    jiraUsername,
    outFile,
    timeRange,
    fetchMode,
    startDate,
    endDate,
    provider,
    // projectIDs,
  };
  return envParams;
};

const printHelp = () => {
  console.log(`
    Flags:
      --provider
          Provider to use
          Default: gitlab
          Options: gitlab, jira, all
      --gitlabPAT:
          GitLab Personal Access Token - Required if provider is gitlab
          Alias: --pat
      --gitlabURL
          GitLab URL - Required if provider is gitlab
          Alias: --url
      --jiraPAT:
          Jira Personal Access Token - Required if provider is jira
      --jiraURL
          Jira URL - Required if provider is jira
      --jiraUsername
          Jira Username - Required if provider is jira
      --outFile,
          Output file name
          Alias: --out
          Default: gitlab_issues.json
      --timeRange,
          Time range for issues
          Alias: --range
          Default: week
          Options: week, month, year, custom
      --fetchMode,
          Fetch mode for issues
          Alias: --mode
          Default: all_contributions
          Options: my_issues, all_contributions
      --startDate,
          Custom start date (Format: MM-DD-YYYY)
          Alias: --start
      --endDate,
          Custom end date (Format: MM-DD-YYYY)
          Alias: --end
      --help,
          Show this help message.
          alias: -h
  `);
  promptExit(null, 0);
};

export const generateConfig = async (): Promise<Config> => {
  const envConfig = await checkENV();

  const args = parseArgs(Deno.args, {
    string: [
      "gitlabPAT",
      "gitlabURL",
      "jiraPAT",
      "jiraURL",
      "jiraUsername",
      "outFile",
      "timeRange",
      "fetchMode",
      "startDate",
      "endDate",
      "provider",
    ],
    // collect: ["projectIDs"],
    boolean: ["help"],
    alias: {
      help: "h",
      gitlabPAT: "pat",
      gitlabURL: "url",
      outFile: "out",
      timeRange: "range",
      fetchMode: "mode",
      startDate: "start",
      endDate: "end",
      // projectIDs: "projects",
    },
  });

  if (args.help) {
    printHelp();
  }

  const combinedConfig: Partial<Config> = {
    provider: (args.provider as "gitlab" | "jira" | "all") ??
      envConfig.provider ??
      "gitlab",
    gitlabPAT: args.gitlabPAT ?? envConfig.gitlabPAT,
    gitlabURL: args.gitlabURL ?? envConfig.gitlabURL,
    jiraPAT: args.jiraPAT ?? envConfig.jiraPAT,
    jiraURL: args.jiraURL ?? envConfig.jiraURL,
    jiraUsername: args.jiraUsername ?? envConfig.jiraUsername,
    outFile: args.outFile ?? envConfig.outFile,
    timeRange: args.timeRange ?? envConfig.timeRange ?? "week",
    fetchMode: args.fetchMode ?? envConfig.fetchMode ?? "all_contributions",
    startDate: args.startDate ?? envConfig.startDate,
    endDate: args.endDate ?? envConfig.endDate,
    // projectIDs: (args.projectIDs as string[]) ?? envConfig.projectIDs,
  };

  if (!combinedConfig.outFile) {
    if (combinedConfig.provider === "jira") {
      combinedConfig.outFile = "jira_issues.json";
    } else if (combinedConfig.provider === "gitlab") {
      combinedConfig.outFile = "gitlab_issues.json";
    } else {
      // For 'all', we will handle filenames in main.ts, but set a dummy here
      combinedConfig.outFile = "issues.json";
    }
  }

  // Validate GitLab Config
  if (
    combinedConfig.provider === "gitlab" || combinedConfig.provider === "all"
  ) {
    if (!combinedConfig.gitlabPAT) {
      const gitlabPAT = promptSecret(
        "Enter your GitLab Personal Access Token:",
        {
          mask: "*",
        },
      );
      if (!gitlabPAT) {
        promptExit("GitLab Personal Access Token is required.", 1);
      }
      combinedConfig.gitlabPAT = gitlabPAT as string;
    }

    if (!combinedConfig.gitlabURL) {
      const gitlabURL = prompt(
        "Enter your GitLab URL (e.g., https://gitlab.com):",
      );
      if (!gitlabURL) {
        promptExit("GitLab URL is required.", 1);
      }
      combinedConfig.gitlabURL = gitlabURL as string;
    }
  }

  // Validate Jira Config
  if (combinedConfig.provider === "jira" || combinedConfig.provider === "all") {
    if (!combinedConfig.jiraPAT) {
      const jiraPAT = promptSecret(
        "Enter your Jira Personal Access Token:",
        {
          mask: "*",
        },
      );
      if (!jiraPAT) {
        promptExit("Jira Personal Access Token is required.", 1);
      }
      combinedConfig.jiraPAT = jiraPAT as string;
    }

    if (!combinedConfig.jiraURL) {
      const jiraURL = prompt(
        "Enter your Jira URL (e.g., https://jira.example.com/):",
      );
      if (!jiraURL) {
        promptExit("Jira URL is required.", 1);
      }
      combinedConfig.jiraURL = jiraURL as string;
    }

    if (!combinedConfig.jiraUsername) {
      const jiraUsername = prompt(
        "Enter your Jira Username:",
      );
      if (!jiraUsername) {
        promptExit("Jira Username is required.", 1);
      }
      combinedConfig.jiraUsername = jiraUsername as string;
    }
  }

  const finalConfig: Config = combinedConfig as Config;

  console.log(`
Configuration:
  - Provider: ${finalConfig.provider}
  - URL(s): ${
    finalConfig.provider === "all"
      ? `GitLab: ${finalConfig.gitlabURL}, Jira: ${finalConfig.jiraURL}`
      : finalConfig.provider === "gitlab"
      ? finalConfig.gitlabURL
      : finalConfig.jiraURL
  }
  - Output File(s): ${
    finalConfig.provider === "all"
      ? "gitlab_issues.json, jira_issues.json"
      : finalConfig.outFile
  }
  - Time Range: ${finalConfig.timeRange}
  - Fetch Mode: ${finalConfig.fetchMode}`);

  return finalConfig;
};

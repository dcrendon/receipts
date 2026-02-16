import { parseArgs, promptSecret } from "@std/cli";
import { load } from "@std/dotenv";
import { getDefaultOutFile, runConfigWizard } from "./tui.ts";
import { Config } from "./types.ts";

export const promptExit = (message: string | null, exitCode: number): never => {
  if (message) {
    console.log(message);
  }
  if (Deno.stdin.isTerminal()) {
    prompt("\nPress Enter to close...");
  }
  Deno.exit(exitCode);
};

const parseBoolean = (value?: string): boolean | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return undefined;
};

const checkENV = async (): Promise<Partial<Config>> => {
  await load({ export: true });
  const gitlabPAT = Deno.env.get("GITLAB_PAT");
  const gitlabURL = Deno.env.get("GITLAB_URL");
  const jiraPAT = Deno.env.get("JIRA_PAT");
  const jiraURL = Deno.env.get("JIRA_URL");
  const jiraUsername = Deno.env.get("JIRA_USERNAME");
  const githubPAT = Deno.env.get("GITHUB_PAT");
  const githubURL = Deno.env.get("GITHUB_URL");
  const githubUsername = Deno.env.get("GITHUB_USERNAME");
  const outFile = Deno.env.get("OUT_FILE");
  const timeRange = Deno.env.get("TIME_RANGE");
  const fetchMode = Deno.env.get("FETCH_MODE");
  const startDate = Deno.env.get("START_DATE");
  const endDate = Deno.env.get("END_DATE");
  const provider = Deno.env.get("PROVIDER") as
    | "gitlab"
    | "jira"
    | "github"
    | "all"
    | undefined;
  const useMockData = parseBoolean(Deno.env.get("USE_MOCK_DATA") ?? undefined);
  const mockDataDir = Deno.env.get("MOCK_DATA_DIR");
  // const projectIDs = Deno.env.get("PROJECT_IDS")?.split(",");
  const envParams: Partial<Config> = {
    gitlabPAT,
    gitlabURL,
    jiraPAT,
    jiraURL,
    jiraUsername,
    githubPAT,
    githubURL,
    githubUsername,
    outFile,
    timeRange,
    fetchMode,
    startDate,
    endDate,
    provider,
    useMockData,
    mockDataDir,
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
          Options: gitlab, jira, github, all
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
      --githubPAT:
          GitHub Personal Access Token - Required if provider is github
      --githubURL
          GitHub API URL - Required if provider is github
          Example: https://api.github.com
      --githubUsername
          GitHub Username - Required if provider is github
      --outFile,
          Output file name
          Alias: --out
          Default: provider_issues.json (depending on provider)
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
      --tui
          Launch interactive wizard-style TUI flow
      --useMockData
          Use local fixture files instead of provider APIs
          Alias: --mock
          Env: USE_MOCK_DATA=true
      --mockDataDir
          Directory containing mock fixture files
          Default: fixtures
          Env: MOCK_DATA_DIR
  `);
  promptExit(null, 0);
};

export const generateConfig = async (rawArgs = Deno.args): Promise<Config> => {
  const envConfig = await checkENV();

  const args = parseArgs(rawArgs, {
    string: [
      "gitlabPAT",
      "gitlabURL",
      "jiraPAT",
      "jiraURL",
      "jiraUsername",
      "githubPAT",
      "githubURL",
      "githubUsername",
      "outFile",
      "timeRange",
      "fetchMode",
      "startDate",
      "endDate",
      "provider",
      "mockDataDir",
    ],
    // collect: ["projectIDs"],
    boolean: ["help", "useMockData", "tui"],
    alias: {
      help: "h",
      useMockData: "mock",
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
  const hasUseMockDataArg = Object.prototype.hasOwnProperty.call(
    args,
    "useMockData",
  );

  const combinedConfig: Partial<Config> = {
    provider: (args.provider as "gitlab" | "jira" | "github" | "all") ??
      envConfig.provider ??
      "gitlab",
    gitlabPAT: args.gitlabPAT ?? envConfig.gitlabPAT,
    gitlabURL: args.gitlabURL ?? envConfig.gitlabURL,
    jiraPAT: args.jiraPAT ?? envConfig.jiraPAT,
    jiraURL: args.jiraURL ?? envConfig.jiraURL,
    jiraUsername: args.jiraUsername ?? envConfig.jiraUsername,
    githubPAT: args.githubPAT ?? envConfig.githubPAT,
    githubURL: args.githubURL ?? envConfig.githubURL,
    githubUsername: args.githubUsername ?? envConfig.githubUsername,
    outFile: args.outFile ?? envConfig.outFile,
    timeRange: args.timeRange ?? envConfig.timeRange ?? "week",
    fetchMode: args.fetchMode ?? envConfig.fetchMode ?? "all_contributions",
    startDate: args.startDate ?? envConfig.startDate,
    endDate: args.endDate ?? envConfig.endDate,
    useMockData: hasUseMockDataArg
      ? Boolean(args.useMockData)
      : envConfig.useMockData ?? false,
    mockDataDir: args.mockDataDir ?? envConfig.mockDataDir,
    // projectIDs: (args.projectIDs as string[]) ?? envConfig.projectIDs,
  };

  if (args.tui) {
    return await runConfigWizard(combinedConfig);
  }

  if (!combinedConfig.outFile) {
    combinedConfig.outFile = getDefaultOutFile(
      combinedConfig.provider ?? "gitlab",
    );
  }

  // Validate GitLab Config
  if (
    !combinedConfig.useMockData &&
    (combinedConfig.provider === "gitlab" || combinedConfig.provider === "all")
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
  if (
    !combinedConfig.useMockData &&
    (combinedConfig.provider === "jira" || combinedConfig.provider === "all")
  ) {
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

  // Validate GitHub Config
  if (
    !combinedConfig.useMockData &&
    (combinedConfig.provider === "github" || combinedConfig.provider === "all")
  ) {
    if (!combinedConfig.githubPAT) {
      const githubPAT = promptSecret(
        "Enter your GitHub Personal Access Token:",
        { mask: "*" },
      );
      if (!githubPAT) {
        promptExit("GitHub Personal Access Token is required.", 1);
      }
      combinedConfig.githubPAT = githubPAT as string;
    }

    if (!combinedConfig.githubURL) {
      const githubURL = prompt(
        "Enter your GitHub API URL (e.g., https://api.github.com):",
      );
      if (!githubURL) {
        promptExit("GitHub API URL is required.", 1);
      }
      combinedConfig.githubURL = githubURL as string;
    }

    if (!combinedConfig.githubUsername) {
      const githubUsername = prompt("Enter your GitHub Username:");
      if (!githubUsername) {
        promptExit("GitHub Username is required.", 1);
      }
      combinedConfig.githubUsername = githubUsername as string;
    }
  }

  const finalConfig: Config = combinedConfig as Config;

  console.log(`
Configuration:
  - Provider: ${finalConfig.provider}
  - URL(s): ${
    finalConfig.provider === "all"
      ? `GitLab: ${finalConfig.gitlabURL}, Jira: ${finalConfig.jiraURL}, GitHub: ${finalConfig.githubURL}`
      : finalConfig.provider === "gitlab"
      ? finalConfig.gitlabURL
      : finalConfig.provider === "github"
      ? finalConfig.githubURL
      : finalConfig.jiraURL
  }
  - Output File(s): ${
    finalConfig.provider === "all"
      ? "gitlab_issues.json, jira_issues.json, github_issues.json"
      : finalConfig.outFile
  }
  - Time Range: ${finalConfig.timeRange}
  - Fetch Mode: ${finalConfig.fetchMode}
  - Mock Data: ${finalConfig.useMockData ? "enabled" : "disabled"}
  - Mock Dir: ${finalConfig.mockDataDir ?? "fixtures"}`);

  return finalConfig;
};

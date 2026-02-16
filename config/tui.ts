import { promptSecret } from "@std/cli";
import { Config } from "../shared/types.ts";

const PROVIDERS = ["gitlab", "jira", "github", "all"] as const;
const TIME_RANGES = ["week", "month", "year", "custom"] as const;
const FETCH_MODES = ["my_issues", "all_contributions"] as const;
const OUTPUT_DIR = "output";

const isNonEmpty = (value: string | null): value is string =>
  Boolean(value && value.trim().length > 0);

export const getDefaultOutFile = (provider: Config["provider"]): string => {
  if (provider === "gitlab") return `${OUTPUT_DIR}/gitlab_issues.json`;
  if (provider === "jira") return `${OUTPUT_DIR}/jira_issues.json`;
  if (provider === "github") return `${OUTPUT_DIR}/github_issues.json`;
  return `${OUTPUT_DIR}/issues.json`;
};

export const normalizeChoice = <T extends readonly string[]>(
  rawValue: string | undefined,
  allowed: T,
): T[number] | undefined => {
  if (!rawValue) return undefined;
  const normalized = rawValue.trim().toLowerCase();
  const found = allowed.find((value) => value === normalized);
  return found;
};

const askChoice = <T extends readonly string[]>(
  question: string,
  options: T,
  defaultValue: T[number],
): T[number] => {
  while (true) {
    const raw = prompt(
      `${question} [${options.join("/")}] (default: ${defaultValue})`,
    );
    const value = normalizeChoice(raw ?? defaultValue, options);
    if (value) return value;
    console.log(`Invalid value. Use one of: ${options.join(", ")}`);
  }
};

const askBoolean = (question: string, defaultValue: boolean): boolean => {
  while (true) {
    const raw = prompt(
      `${question} [y/n] (default: ${defaultValue ? "y" : "n"})`,
    );
    const normalized = (raw ?? (defaultValue ? "y" : "n")).trim().toLowerCase();
    if (["y", "yes"].includes(normalized)) return true;
    if (["n", "no"].includes(normalized)) return false;
    console.log("Invalid value. Use y or n.");
  }
};

const askRequiredText = (question: string, defaultValue?: string): string => {
  while (true) {
    const suffix = defaultValue ? ` (default: ${defaultValue})` : "";
    const raw = prompt(`${question}${suffix}`);
    const value = isNonEmpty(raw) ? raw.trim() : defaultValue?.trim();
    if (value) return value;
    console.log("This field is required.");
  }
};

const askOptionalText = (
  question: string,
  defaultValue?: string,
): string | undefined => {
  const suffix = defaultValue ? ` (default: ${defaultValue})` : "";
  const raw = prompt(`${question}${suffix}`);
  const value = isNonEmpty(raw) ? raw.trim() : defaultValue?.trim();
  return value && value.length > 0 ? value : undefined;
};

const askRequiredSecret = (question: string, defaultValue?: string): string => {
  const useDefault = Boolean(defaultValue) &&
    askBoolean(`${question}: keep existing value?`, true);
  if (useDefault && defaultValue) {
    return defaultValue;
  }

  while (true) {
    const raw = promptSecret(question, { mask: "*" });
    if (isNonEmpty(raw)) {
      return raw.trim();
    }
    console.log("This field is required.");
  }
};

const providerSelected = (
  runProvider: Config["provider"],
  provider: "gitlab" | "jira" | "github",
) => {
  return runProvider === provider || runProvider === "all";
};

export const runConfigWizard = async (
  seed: Partial<Config>,
): Promise<Config> => {
  console.log("\nIssue Fetcher Wizard");
  console.log("Follow the prompts to configure a run.\n");

  const provider = askChoice(
    "Step 1/6 - Select provider",
    PROVIDERS,
    normalizeChoice(seed.provider, PROVIDERS) ?? "gitlab",
  );

  const useMockData = askBoolean(
    "Step 2/6 - Use mock fixture data (no provider API calls)?",
    seed.useMockData ?? false,
  );

  const timeRange = askChoice(
    "Step 3/6 - Select time range",
    TIME_RANGES,
    normalizeChoice(seed.timeRange, TIME_RANGES) ?? "week",
  );

  let startDate = seed.startDate;
  let endDate = seed.endDate;
  if (timeRange === "custom") {
    startDate = askRequiredText(
      "Enter custom START_DATE (MM-DD-YYYY)",
      seed.startDate,
    );
    endDate = askRequiredText(
      "Enter custom END_DATE (MM-DD-YYYY)",
      seed.endDate,
    );
  }

  const fetchMode = askChoice(
    "Step 4/6 - Select fetch mode",
    FETCH_MODES,
    normalizeChoice(seed.fetchMode, FETCH_MODES) ?? "all_contributions",
  );

  const outFile = provider === "all"
    ? `${OUTPUT_DIR}/issues.json`
    : askRequiredText(
      "Step 5/6 - Output file name",
      seed.outFile ?? getDefaultOutFile(provider),
    );

  const mockDataDir = useMockData
    ? askOptionalText(
      "Step 6/6 - Mock fixture directory",
      seed.mockDataDir ?? "fixtures",
    )
    : seed.mockDataDir;

  const config: Config = {
    provider,
    outFile,
    timeRange,
    fetchMode,
    startDate,
    endDate,
    useMockData,
    mockDataDir,
    gitlabPAT: seed.gitlabPAT,
    gitlabURL: seed.gitlabURL,
    jiraPAT: seed.jiraPAT,
    jiraURL: seed.jiraURL,
    jiraUsername: seed.jiraUsername,
    githubPAT: seed.githubPAT,
    githubURL: seed.githubURL,
    githubUsername: seed.githubUsername,
  };

  if (!useMockData) {
    if (providerSelected(provider, "gitlab")) {
      config.gitlabPAT = askRequiredSecret(
        "Enter GitLab Personal Access Token",
        seed.gitlabPAT,
      );
      config.gitlabURL = askRequiredText(
        "Enter GitLab URL (e.g., https://gitlab.com)",
        seed.gitlabURL,
      );
    }

    if (providerSelected(provider, "jira")) {
      config.jiraPAT = askRequiredSecret(
        "Enter Jira Personal Access Token",
        seed.jiraPAT,
      );
      config.jiraURL = askRequiredText(
        "Enter Jira URL (e.g., https://jira.example.com/)",
        seed.jiraURL,
      );
      config.jiraUsername = askRequiredText(
        "Enter Jira username",
        seed.jiraUsername,
      );
    }

    if (providerSelected(provider, "github")) {
      config.githubPAT = askRequiredSecret(
        "Enter GitHub Personal Access Token",
        seed.githubPAT,
      );
      config.githubURL = askRequiredText(
        "Enter GitHub API URL (e.g., https://api.github.com)",
        seed.githubURL,
      );
      config.githubUsername = askRequiredText(
        "Enter GitHub username",
        seed.githubUsername,
      );
    }
  }

  console.log("\nWizard Configuration:");
  console.log(`- Provider: ${config.provider}`);
  console.log(`- Time Range: ${config.timeRange}`);
  console.log(`- Fetch Mode: ${config.fetchMode}`);
  console.log(`- Mock Data: ${config.useMockData ? "enabled" : "disabled"}`);
  console.log(
    `- Output: ${
      config.provider === "all"
        ? `${OUTPUT_DIR}/gitlab_issues.json, ${OUTPUT_DIR}/jira_issues.json, ${OUTPUT_DIR}/github_issues.json`
        : config.outFile
    }`,
  );

  const confirmed = askBoolean("Start run with this configuration?", true);
  if (!confirmed) {
    console.log("Run canceled.");
    Deno.exit(0);
  }

  return config;
};

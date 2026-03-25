import { promptSecret } from "@std/cli";
import { Config } from "../shared/types.ts";
import {
  describeProviderField,
  getMissingFieldsForProvider,
  getProviderReadiness,
  providerLabel,
} from "./provider_readiness.ts";
import { ProviderName } from "../providers/types.ts";

const TIME_RANGES = ["week", "month", "year", "custom"] as const;
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
  if (!normalized) return undefined;
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
    const value = normalizeChoice(raw ?? undefined, options) ??
      normalizeChoice(defaultValue, options);
    if (value) return value;
    console.log(`Invalid value. Use one of: ${options.join(", ")}`);
  }
};

const askBoolean = (question: string, defaultValue: boolean): boolean => {
  while (true) {
    const defaultHint = defaultValue ? "[Y/n]" : "[y/N]";
    const raw = prompt(`${question} ${defaultHint}`);
    const normalized = (raw ?? "").trim().toLowerCase();
    if (!normalized) return defaultValue;
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

const getWizardTotalSteps = (): number => 2;

const formatWizardStep = (
  step: number,
  totalSteps: number,
  label: string,
): string => `Step ${step}/${totalSteps} - ${label}`;

const formatMissingFields = (fields: (keyof Config)[]): string =>
  fields.map(describeProviderField).join(", ");

export const formatProviderReadinessSummary = (config: Config): string[] => {
  const readiness = getProviderReadiness(config);
  const lines = ["Provider readiness:"];
  const longestLabel = readiness.selectedProviders.reduce(
    (max, provider) => Math.max(max, providerLabel(provider).length),
    0,
  );

  for (const provider of readiness.selectedProviders) {
    const label = providerLabel(provider).padEnd(longestLabel);
    const missing = readiness.missingByProvider[provider] ?? [];
    if (missing.length === 0) {
      lines.push(`- ${label} | ready`);
    } else {
      lines.push(`- ${label} | skipping`);
    }
  }

  return lines;
};

const captureProviderCredentials = (
  config: Config,
  provider: ProviderName,
): void => {
  const missing = getMissingFieldsForProvider(config, provider);
  if (!missing.length) {
    return;
  }

  console.log(`\n${providerLabel(provider)} is missing required credentials.`);

  for (const field of missing) {
    if (field === "gitlabPAT") {
      config.gitlabPAT = askRequiredSecret(
        "Enter GitLab Personal Access Token",
      );
      continue;
    }
    if (field === "gitlabURL") {
      config.gitlabURL = askRequiredText(
        "Enter GitLab URL (e.g., https://gitlab.com)",
        config.gitlabURL,
      );
      continue;
    }
    if (field === "jiraPAT") {
      config.jiraPAT = askRequiredSecret("Enter Jira Personal Access Token");
      continue;
    }
    if (field === "jiraURL") {
      config.jiraURL = askRequiredText(
        "Enter Jira URL (e.g., https://jira.example.com/)",
        config.jiraURL,
      );
      continue;
    }
    if (field === "jiraUsername") {
      config.jiraUsername = askRequiredText(
        "Enter Jira username",
        config.jiraUsername,
      );
      continue;
    }
    if (field === "githubPAT") {
      config.githubPAT = askRequiredSecret(
        "Enter GitHub Personal Access Token",
      );
      continue;
    }
    if (field === "githubURL") {
      config.githubURL = askRequiredText(
        "Enter GitHub API URL (e.g., https://api.github.com)",
        config.githubURL,
      );
      continue;
    }
    if (field === "githubUsername") {
      config.githubUsername = askRequiredText(
        "Enter GitHub username",
        config.githubUsername,
      );
    }
  }
};

export const runConfigWizard = (
  seed: Config,
): Config => {
  console.log("\nIssue Fetcher Wizard");
  console.log(
    "Configure this run. Missing provider credentials can be added now.",
  );

  const totalSteps = getWizardTotalSteps();
  let step = 1;

  const timeRange = askChoice(
    formatWizardStep(step++, totalSteps, "Select time range"),
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

  const config: Config = {
    ...seed,
    provider: "all",
    outFile: `${OUTPUT_DIR}/issues.json`,
    timeRange,
    startDate,
    endDate,
  };

  console.log(
    formatWizardStep(step, totalSteps, "Review provider credentials"),
  );

  const targetProviders: ProviderName[] = ["gitlab", "jira", "github"];

  for (const target of targetProviders) {
    const missing = getMissingFieldsForProvider(config, target);
    if (!missing.length) continue;

    const shouldCapture = askBoolean(
      `${providerLabel(target)} is missing ${
        formatMissingFields(missing)
      }. Add now?`,
      true,
    );
    if (shouldCapture) {
      captureProviderCredentials(config, target);
    }
  }

  console.log("");
  for (const line of formatProviderReadinessSummary(config)) {
    console.log(line);
  }

  const confirmed = askBoolean("Start run with this configuration?", true);
  if (!confirmed) {
    console.log("Run canceled.");
    Deno.exit(0);
  }

  return config;
};

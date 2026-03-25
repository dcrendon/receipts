import { Config } from "../shared/types.ts";
import { ProviderName } from "../providers/types.ts";

const PROVIDERS: ProviderName[] = ["gitlab", "jira", "github"];

export const PROVIDER_REQUIREMENTS: Record<ProviderName, (keyof Config)[]> = {
  gitlab: ["gitlabPAT", "gitlabURL"],
  jira: ["jiraPAT", "jiraURL", "jiraUsername"],
  github: ["githubPAT", "githubURL", "githubUsername"],
};

const hasValue = (value: unknown): boolean => {
  return typeof value === "string" && value.trim().length > 0;
};

const providerSelected = (
  config: Pick<Config, "provider">,
  provider: ProviderName,
): boolean => {
  return config.provider === "all" || config.provider === provider;
};

export interface ProviderReadiness {
  selectedProviders: ProviderName[];
  runnableProviders: ProviderName[];
  missingByProvider: Partial<Record<ProviderName, (keyof Config)[]>>;
}

export const getMissingFieldsForProvider = (
  config: Partial<Config>,
  provider: ProviderName,
): (keyof Config)[] => {
  return PROVIDER_REQUIREMENTS[provider].filter((field) =>
    !hasValue(config[field])
  );
};

export const getProviderReadiness = (config: Config): ProviderReadiness => {
  const selectedProviders = PROVIDERS.filter((provider) =>
    providerSelected(config, provider)
  );
  const runnableProviders: ProviderName[] = [];
  const missingByProvider: Partial<Record<ProviderName, (keyof Config)[]>> = {};

  for (const provider of selectedProviders) {
    const missing = getMissingFieldsForProvider(config, provider);
    if (missing.length === 0) {
      runnableProviders.push(provider);
    } else {
      missingByProvider[provider] = missing;
    }
  }

  return {
    selectedProviders,
    runnableProviders,
    missingByProvider,
  };
};

export const isProviderRunnable = (
  config: Config,
  provider: ProviderName,
): boolean => {
  if (!providerSelected(config, provider)) {
    return false;
  }
  return getMissingFieldsForProvider(config, provider).length === 0;
};

export const providerLabel = (provider: ProviderName): string => {
  if (provider === "gitlab") return "GitLab";
  if (provider === "jira") return "Jira";
  return "GitHub";
};

export const describeProviderField = (field: keyof Config): string => {
  if (field === "gitlabPAT") return "GitLab PAT";
  if (field === "gitlabURL") return "GitLab URL";
  if (field === "jiraPAT") return "Jira PAT";
  if (field === "jiraURL") return "Jira URL";
  if (field === "jiraUsername") return "Jira username";
  if (field === "githubPAT") return "GitHub PAT";
  if (field === "githubURL") return "GitHub URL";
  if (field === "githubUsername") return "GitHub username";
  return String(field);
};

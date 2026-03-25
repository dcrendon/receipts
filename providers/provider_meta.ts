import { ProviderName } from "./types.ts";

const PROVIDER_LABELS: Record<ProviderName, string> = {
  gitlab: "GitLab",
  jira: "Jira",
  github: "GitHub",
};

export const providerLabel = (provider: ProviderName): string => {
  return PROVIDER_LABELS[provider];
};

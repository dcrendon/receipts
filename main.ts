import {
  buildRuntimeConfig,
  loadEnvConfig,
  promptExit,
} from "./config/config.ts";
import { getDateRange } from "./config/dates.ts";
import {
  describeProviderField,
  getProviderReadiness,
  providerLabel as readinessProviderLabel,
} from "./config/provider_readiness.ts";
import { runConfigWizard } from "./config/tui.ts";
import {
  evaluateRunStatus,
  EXIT_CODES,
  ProviderRunResult,
} from "./core/run_status.ts";
import { getProviderAdapters } from "./providers/index.ts";
import { providerLabel } from "./providers/provider_meta.ts";
import { ProviderName } from "./providers/types.ts";
import { buildRunReport, writeRunReport } from "./reporting/reporting.ts";
import { Config } from "./shared/types.ts";

const formatMissingProviders = (
  missingByProvider: Partial<Record<ProviderName, (keyof Config)[]>>,
): string => {
  const chunks: string[] = [];
  for (const provider of ["gitlab", "jira", "github"] as ProviderName[]) {
    const missing = missingByProvider[provider] ?? [];
    if (!missing.length) continue;
    chunks.push(
      `${readinessProviderLabel(provider)} missing ${
        missing.map(describeProviderField).join(", ")
      }`,
    );
  }
  return chunks.join("; ");
};

const runFetch = async (config: Config) => {
  const readiness = getProviderReadiness(config);

  const skippedProviders = readiness.selectedProviders.filter((provider) =>
    !readiness.runnableProviders.includes(provider)
  );

  if (readiness.runnableProviders.length === 0) {
    promptExit(
      `No provider credentials found for selected provider(s). ${
        formatMissingProviders(readiness.missingByProvider)
      }`,
      1,
    );
  }

  const { startDate, endDate } = getDateRange(config);
  const runResults: ProviderRunResult[] = [];
  const successfulIssues: Partial<Record<ProviderName, unknown[]>> = {};
  const adapters = getProviderAdapters();
  const requestedProviders = readiness.runnableProviders;

  for (const adapter of adapters) {
    if (!adapter.canRun(config)) {
      continue;
    }

    try {
      console.log(`\n[${providerLabel(adapter.name)}] Fetching issues...`);
      const issues = await adapter.fetchIssues(config, { startDate, endDate });
      const providerTitle = providerLabel(adapter.name);
      console.log(`[${providerTitle}] Completed: ${issues.length} issues.`);

      runResults.push({
        provider: adapter.name,
        status: "success",
        issueCount: issues.length,
      });
      successfulIssues[adapter.name] = issues;
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      const providerTitle = providerLabel(adapter.name);
      console.error(`\n${providerTitle} provider failed: ${errorMessage}`);
      runResults.push({
        provider: adapter.name,
        status: "failed",
        issueCount: 0,
        error: errorMessage,
      });
    }
  }

  const runStatus = evaluateRunStatus(runResults);

  const successfulResults = runResults.filter((result) =>
    result.status === "success"
  );
  if (successfulResults.length > 0) {
    try {
      const report = await buildRunReport(successfulIssues, {
        startDate,
        endDate,
        aiModel: config.aiModel ?? "gpt-4o-mini",
        sourceMode: "fetch",
        generatedAt: new Date().toISOString(),
        openaiApiKey: config.openaiApiKey,
        usernames: {
          gitlab: config.gitlabUsername,
          jira: config.jiraUsername,
          github: config.githubUsername,
        },
      }, {
        diagnostics: {
          sourceMode: "fetch",
          requestedProviders,
          runResults,
        },
      });
      const { htmlPath, normalizedPath } = await writeRunReport(report);
      console.log(`\nSummary HTML report written to ${htmlPath}`);
      console.log(`Normalized issues written to ${normalizedPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\nReport generation failed: ${message}`);
    }
  }

  console.log("\nRun Summary:");
  for (const result of runResults) {
    const providerTitle = readinessProviderLabel(result.provider);
    const suffix = result.status === "success"
      ? `${result.issueCount} issues`
      : result.error ?? "unknown error";
    console.log(`- ${providerTitle}: ${result.status} (${suffix})`);
  }

  for (const provider of skippedProviders) {
    console.log(
      `- ${readinessProviderLabel(provider)}: skipped`,
    );
  }

  promptExit(
    `Process completed with status: ${runStatus}.`,
    EXIT_CODES[runStatus],
  );
};

const main = async () => {
  if (Deno.args.length > 0) {
    console.log(
      "Ignoring CLI args. This app now uses .env + TUI only.",
    );
  }

  let envConfig: Partial<Config> = {};
  try {
    envConfig = await loadEnvConfig();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    promptExit(message, 1);
  }

  const baseConfig = buildRuntimeConfig({
    envConfig,
  });

  const config = Deno.stdin.isTerminal()
    ? runConfigWizard(baseConfig)
    : baseConfig;

  await runFetch(config);
};

if (import.meta.main) {
  main();
}

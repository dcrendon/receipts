import { parseArgs } from "@std/cli";
import { generateConfig, promptExit } from "./config.ts";
import { printCommandHelp, resolveCommand } from "./core/cli.ts";
import {
  evaluateRunStatus,
  EXIT_CODES,
  ProviderRunResult,
} from "./core/run_status.ts";
import { getDateRange } from "./dates.ts";
import { getProviderAdapters } from "./providers/index.ts";
import { providerLabel } from "./providers/provider_meta.ts";
import { ProviderName } from "./providers/types.ts";
import { buildRunReport, writeRunReport } from "./reporting/reporting.ts";
import { Config } from "./types.ts";

const runFetch = async (args: string[], useTui: boolean) => {
  const config = await generateConfig(useTui ? [...args, "--tui"] : args);
  const { startDate, endDate } = getDateRange(config);
  const runResults: ProviderRunResult[] = [];
  const successfulIssues: Partial<Record<ProviderName, unknown[]>> = {};
  const adapters = getProviderAdapters();

  for (const adapter of adapters) {
    if (!adapter.canRun(config)) {
      continue;
    }

    try {
      const outFile = adapter.getOutFile(config);
      const issues = await adapter.fetchIssues(config, { startDate, endDate });
      const providerTitle = providerLabel(adapter.name);

      if (!issues.length) {
        console.log(
          `\nNo ${providerTitle} issues found for the specified criteria.`,
        );
      } else {
        await Deno.writeTextFile(
          outFile,
          JSON.stringify(issues, null, 2),
        );
        console.log(`\n${providerTitle} issue data written to ${outFile}`);
      }

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
      const report = buildRunReport(successfulIssues, {
        startDate,
        endDate,
        fetchMode: config.fetchMode,
      });
      const { markdownPath, normalizedPath } = await writeRunReport(report);
      console.log(`\nSummary report written to ${markdownPath}`);
      console.log(`Normalized issues written to ${normalizedPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\nReport generation failed: ${message}`);
    }
  }

  console.log("\nRun Summary:");
  for (const result of runResults) {
    const suffix = result.status === "success"
      ? `${result.issueCount} issues`
      : result.error ?? "unknown error";
    console.log(`- ${result.provider}: ${result.status} (${suffix})`);
  }
  promptExit(
    `Process completed with status: ${runStatus}.`,
    EXIT_CODES[runStatus],
  );
};

const readIssuesFileIfPresent = async (
  path: string,
): Promise<unknown[] | undefined> => {
  try {
    const raw = await Deno.readTextFile(path);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error(`Report source must be an array: ${path}`);
    }
    return parsed;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return undefined;
    }
    throw error;
  }
};

const runReportCommand = async (args: string[]) => {
  const parsed = parseArgs(args, {
    string: [
      "provider",
      "gitlabFile",
      "jiraFile",
      "githubFile",
      "startDate",
      "endDate",
      "fetchMode",
    ],
    alias: {
      provider: "p",
    },
  });

  const provider = (parsed.provider as Config["provider"] | undefined) ?? "all";
  const gitlabFile = parsed.gitlabFile ?? "gitlab_issues.json";
  const jiraFile = parsed.jiraFile ?? "jira_issues.json";
  const githubFile = parsed.githubFile ?? "github_issues.json";

  const providerIssues: Partial<Record<ProviderName, unknown[]>> = {};

  if (provider === "gitlab" || provider === "all") {
    const issues = await readIssuesFileIfPresent(gitlabFile);
    if (issues) providerIssues.gitlab = issues;
  }
  if (provider === "jira" || provider === "all") {
    const issues = await readIssuesFileIfPresent(jiraFile);
    if (issues) providerIssues.jira = issues;
  }
  if (provider === "github" || provider === "all") {
    const issues = await readIssuesFileIfPresent(githubFile);
    if (issues) providerIssues.github = issues;
  }

  const loadedProviders = Object.keys(providerIssues);
  if (!loadedProviders.length) {
    promptExit(
      "No provider issue files found. Run fetch first or pass --gitlabFile/--jiraFile/--githubFile.",
      1,
    );
  }

  const report = buildRunReport(providerIssues, {
    startDate: parsed.startDate ?? "unknown",
    endDate: parsed.endDate ?? "unknown",
    fetchMode: parsed.fetchMode ?? "all_contributions",
  });
  const { markdownPath, normalizedPath } = await writeRunReport(report);
  console.log(`\nSummary report written to ${markdownPath}`);
  console.log(`Normalized issues written to ${normalizedPath}`);
  promptExit("Report generation completed successfully.", 0);
};

const main = async () => {
  const resolved = resolveCommand(Deno.args);

  if (resolved.command === "help") {
    printCommandHelp();
    promptExit(null, 0);
  }

  if (resolved.command === "report") {
    await runReportCommand(resolved.args);
    return;
  }

  if (resolved.command === "tui") {
    await runFetch(resolved.args, true);
    return;
  }

  if (resolved.command === "legacy") {
    console.log(
      "\nWarning: legacy invocation detected. Prefer `fetch`, `tui`, or `report` subcommands.",
    );
    await runFetch(resolved.args, false);
    return;
  }

  await runFetch(resolved.args, false);
};

if (import.meta.main) {
  main();
}

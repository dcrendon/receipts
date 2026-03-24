import { ProviderName } from "../providers/types.ts";
import {
  buildCoverageSummary,
  buildProviderDistribution,
  buildReportSummary,
  compareUpdatedAtDesc,
  normalizeProviderIssues,
  ReportBuildOptions,
  ReportContext,
  RunReport,
} from "./normalizer.ts";
import { generateNarrative } from "./narrative.ts";
import { renderHtml } from "./renderer.ts";

export type {
  ActivityBucket,
  NormalizedIssue,
  ReportBuildOptions,
  ReportContext,
  ReportCoverageSummary,
  ReportSummary,
  RunReport,
} from "./normalizer.ts";

export { buildReportSummary, normalizeProviderIssues } from "./normalizer.ts";

export const buildRunReport = async (
  providerIssues: Partial<Record<ProviderName, unknown[]>>,
  context: ReportContext,
  options: ReportBuildOptions = {},
): Promise<RunReport> => {
  const generatedAt = context.generatedAt ?? new Date().toISOString();
  const usernames = context.usernames ?? {};

  const allIssues = Object.keys(providerIssues as Record<string, unknown[]>)
    .flatMap(
      (provider) =>
        normalizeProviderIssues(
          provider as ProviderName,
          providerIssues[provider as ProviderName] ?? [],
          usernames[provider as ProviderName],
        ),
    );

  // Sort by recency (updatedAt desc)
  const normalizedIssues = allIssues.sort((a, b) =>
    compareUpdatedAtDesc(a.updatedAt, b.updatedAt)
  );

  const summary = buildReportSummary(normalizedIssues);
  const coverage = buildCoverageSummary(summary, options.diagnostics);
  const providerDistribution = buildProviderDistribution(summary.byProvider);

  const narrative = await generateNarrative(
    normalizedIssues,
    summary,
    { startDate: context.startDate, endDate: context.endDate },
    context.geminiApiKey,
  );

  const html = renderHtml({
    summary,
    narrative,
    normalizedIssues,
    coverage,
    context: {
      startDate: context.startDate,
      endDate: context.endDate,
      generatedAt,
    },
    providerDistribution,
  });

  return {
    normalizedIssues,
    summary,
    coverage,
    providerDistribution,
    html,
    context: { startDate: context.startDate, endDate: context.endDate },
  };
};

const formatFilenameDate = (isoDate: string): string => {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return "unknown";
  return `${d.getUTCFullYear()}-${
    String(d.getUTCMonth() + 1).padStart(2, "0")
  }-${String(d.getUTCDate()).padStart(2, "0")}`;
};

const buildOutputFileBase = (report: RunReport): string => {
  const start = formatFilenameDate(report.context.startDate);
  const end = formatFilenameDate(report.context.endDate);
  const providers = report.providerDistribution
    .filter((p) => p.count > 0)
    .map((p) => p.provider)
    .sort()
    .join("-");
  return `${start}_to_${end}_${providers || "none"}`;
};

export const writeRunReport = async (
  report: RunReport,
): Promise<{ htmlPath: string; normalizedPath: string }> => {
  const outputDir = "output";
  await Deno.mkdir(outputDir, { recursive: true });

  const fileBase = buildOutputFileBase(report);
  const keepFiles = new Set<string>();

  const normalizedPath = `${outputDir}/${fileBase}-normalized.json`;
  const normalizedForJson = report.normalizedIssues.map(
    ({ descriptionSnippet: _s, ...issue }) => issue,
  );
  await Deno.writeTextFile(
    normalizedPath,
    JSON.stringify(normalizedForJson, null, 2),
  );
  keepFiles.add(normalizedPath.slice(outputDir.length + 1));

  const htmlPath = `${outputDir}/${fileBase}-summary.html`;
  await Deno.writeTextFile(htmlPath, report.html);
  keepFiles.add(htmlPath.slice(outputDir.length + 1));

  for await (const entry of Deno.readDir(outputDir)) {
    if (!entry.isFile) {
      await Deno.remove(`${outputDir}/${entry.name}`, { recursive: true });
      continue;
    }
    if (keepFiles.has(entry.name)) continue;
    await Deno.remove(`${outputDir}/${entry.name}`);
  }

  return { htmlPath, normalizedPath };
};

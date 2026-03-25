import { ProviderName } from "../providers/types.ts";

export type ProviderStatus = "success" | "failed";
export type RunStatus = "SUCCESS" | "PARTIAL" | "FAILED";

export interface ProviderRunResult {
  provider: ProviderName;
  status: ProviderStatus;
  issueCount: number;
  error?: string;
}

export const EXIT_CODES: Record<RunStatus, number> = {
  SUCCESS: 0,
  FAILED: 1,
  PARTIAL: 2,
};

export const evaluateRunStatus = (results: ProviderRunResult[]): RunStatus => {
  const successCount = results.filter((r) => r.status === "success").length;
  const failedCount = results.filter((r) => r.status === "failed").length;

  if (failedCount === 0 && successCount > 0) {
    return "SUCCESS";
  }

  if (successCount > 0 && failedCount > 0) {
    return "PARTIAL";
  }

  return "FAILED";
};

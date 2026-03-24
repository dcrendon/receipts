import { Config } from "../shared/types.ts";

export type { ProviderName } from "../shared/types.ts";

export interface DateWindow {
  startDate: string;
  endDate: string;
}

export interface ProviderAdapter {
  name: import("../shared/types.ts").ProviderName;
  canRun(config: Config): boolean;
  getOutFile(config: Config): string;
  fetchIssues(config: Config, dateWindow: DateWindow): Promise<unknown[]>;
}

import { assertEquals } from "@std/assert";
import { evaluateRunStatus } from "../../core/run_status.ts";

Deno.test("evaluateRunStatus returns SUCCESS when all providers succeed", () => {
  const status = evaluateRunStatus([
    { provider: "gitlab", status: "success", issueCount: 3 },
    { provider: "jira", status: "success", issueCount: 1 },
  ]);

  assertEquals(status, "SUCCESS");
});

Deno.test("evaluateRunStatus returns PARTIAL when providers are mixed", () => {
  const status = evaluateRunStatus([
    { provider: "gitlab", status: "success", issueCount: 3 },
    { provider: "jira", status: "failed", issueCount: 0, error: "boom" },
  ]);

  assertEquals(status, "PARTIAL");
});

Deno.test("evaluateRunStatus returns FAILED when all providers fail", () => {
  const status = evaluateRunStatus([
    { provider: "gitlab", status: "failed", issueCount: 0, error: "boom1" },
    { provider: "jira", status: "failed", issueCount: 0, error: "boom2" },
  ]);

  assertEquals(status, "FAILED");
});

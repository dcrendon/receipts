import { assertEquals } from "@std/assert";
import { getDateRange } from "../../config/dates.ts";

Deno.test("getDateRange returns ISO bounds for week range", () => {
  const { startDate, endDate } = getDateRange({
    timeRange: "week",
  });

  assertEquals(typeof startDate, "string");
  assertEquals(typeof endDate, "string");
  assertEquals(startDate.includes("T"), true);
  assertEquals(endDate.includes("T"), true);
});

Deno.test("getDateRange returns full-day bounds for custom range", () => {
  const { startDate, endDate } = getDateRange({
    timeRange: "custom",
    startDate: "02-01-2026",
    endDate: "02-02-2026",
  });

  assertEquals(startDate.startsWith("2026-02-01T00:00:00"), true);
  assertEquals(endDate.startsWith("2026-02-02T23:59:59"), true);
});

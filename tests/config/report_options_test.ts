import { assertEquals } from "@std/assert";
import { parseAttributionUsername } from "../../config/report_options.ts";

Deno.test("parseAttributionUsername trims values", () => {
  assertEquals(parseAttributionUsername("  mock.user  "), "mock.user");
  assertEquals(parseAttributionUsername("   "), undefined);
});

import { assertEquals } from "@std/assert";
import { resolveCommand } from "../../core/cli.ts";

Deno.test("resolveCommand resolves explicit subcommands", () => {
  assertEquals(resolveCommand(["fetch", "--provider", "all"]).command, "fetch");
  assertEquals(resolveCommand(["tui"]).command, "tui");
  assertEquals(resolveCommand(["report"]).command, "report");
  assertEquals(resolveCommand(["help"]).command, "help");
});

Deno.test("resolveCommand returns legacy for flag-only invocation", () => {
  const resolved = resolveCommand(["--provider", "all", "--mock"]);
  assertEquals(resolved.command, "legacy");
  assertEquals(resolved.args[0], "--provider");
});

Deno.test("resolveCommand maps unknown token to help", () => {
  assertEquals(resolveCommand(["unknown-command"]).command, "help");
});

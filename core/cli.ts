export type AppCommand = "fetch" | "tui" | "report" | "help" | "legacy";

export interface ResolvedCommand {
  command: AppCommand;
  args: string[];
}

const COMMANDS = new Set(["fetch", "tui", "report", "help"]);

export const resolveCommand = (rawArgs: string[]): ResolvedCommand => {
  if (rawArgs.length === 0) {
    return { command: "legacy", args: [] };
  }

  const first = rawArgs[0].toLowerCase();
  if (COMMANDS.has(first)) {
    return {
      command: first as "fetch" | "tui" | "report" | "help",
      args: rawArgs.slice(1),
    };
  }

  if (first.startsWith("-")) {
    return { command: "legacy", args: rawArgs };
  }

  return { command: "help", args: rawArgs };
};

export const printCommandHelp = () => {
  console.log(`
Usage:
  deno run main.ts fetch [flags]
  deno run main.ts tui
  deno run main.ts report [flags]

Commands:
  fetch   Run provider fetch flow (supports all existing flags)
  tui     Launch wizard-first interactive flow
  report  Build report artifacts from existing provider JSON files

Examples:
  deno run main.ts fetch --provider all --mock
  deno run main.ts tui
  deno run main.ts report --provider all
`);
};

# Contributing

## Workflow

1. Create a branch from latest `main` using prefix `codex/` (example:
   `codex/fix-jira-filter`).
2. Make focused changes for one concern.
3. Run validations:
   - `deno task fmt`
   - `deno test` (or `deno task test`)
   - For interactive flow changes, validate `deno run main.ts tui`
   - For command-surface changes, validate `deno run main.ts help`
   - Confirm retry/rate-limit behavior when provider fetch logic changes
   - `deno run main.ts --help`
   - Optional offline behavior check:
     `deno run --allow-read --allow-env main.ts fetch --provider all --mock`
   - Verify exit behavior for changed runtime flows (`0` success, `1` failed,
     `2` partial)
   - A representative provider run when behavior changes.
4. Update docs/policy files impacted by your change:
   - `readme.md`, `docs/ARCHITECTURE.md`, `AGENTS.md`, `CONTRIBUTING.md`
5. Open a PR with clear scope, test evidence, and risks.

## Commit Message Format

Use concise, imperative messages:

- `feat: add jira comment pagination`
- `fix: validate custom date range earlier`
- `docs: add env examples for provider all`

## Pull Request Expectations

Each PR should include:

- What changed.
- Why it changed.
- How it was validated (commands + outcome).
- Any behavior changes or migration notes.
- Docs updated (or explicit N/A with justification).
- Follow-ups that are intentionally out of scope.

## How To Work With Codex

When requesting work, include:

- Objective: what outcome is needed.
- Constraints: provider, timeline, compatibility, style, or security limits.
- Acceptance criteria: explicit pass/fail conditions.

Request style:

- Ask for plan first when scope is unclear or high-risk.
- Ask for direct implementation when scope is clear and bounded.
- Ask for a final diff/test summary including:
  - Files changed.
  - Key behavior changes.
  - Commands run and results.
  - Known limitations.

## Definition Of Done

A change is done when:

1. Required behavior is implemented and matches acceptance criteria.
2. Formatting is clean.
3. Tests are added for non-trivial changes and passing.
4. Basic runtime validation is completed for affected flow(s).
5. Documentation and policy files are updated where impacted.
6. No secrets are introduced in code, logs, or docs.

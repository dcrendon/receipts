# AGENTS.md

This file defines how AI agents and human contributors should operate in this
repository.

## Project Goal

Build and maintain a Deno CLI that fetches issue activity from GitLab, Jira, and
GitHub and writes provider JSON plus normalized report output for a selected
time range and fetch mode.

## Non-Goals

- Building a hosted service or web UI.
- Persisting data to databases.
- Replacing provider APIs with unofficial scrapers.
- Logging secrets or exposing PATs in output.

## Canonical Commands

- Fetch issues: `deno run main.ts fetch`
- Run wizard TUI: `deno run main.ts tui`
- Build reports from existing files: `deno run main.ts report --provider all`
- Run CLI (offline fixtures):
  `deno run --allow-read --allow-env main.ts fetch --provider all --mock`
- Run with watch: `deno task dev`
- Format: `deno task fmt`
- Test suite: `deno test` (or `deno task test`)

When validating changes, run `deno task fmt`, `deno test`, and a representative
CLI run for the touched provider path.

## Coding Constraints

- Language: TypeScript (Deno runtime).
- Keep changes focused and minimal; avoid broad refactors unless requested.
- Do not log PATs, auth headers, or full secret-bearing config.
- Prefer explicit error handling with actionable messages.
- Keep runtime exit semantics machine-friendly (structured exit codes and no
  interactive blocking in non-interactive runs).
- Use shared HTTP retry/backoff utilities for provider API calls instead of
  copy/pasted fetch retry logic.
- Keep provider behavior consistent unless a behavior change is required.

## Change Policy

- Keep PRs small and task-scoped.
- Do not modify unrelated files.
- Every non-trivial code change must include tests.
- Every behavior/process change must update docs in the same PR:
  - `readme.md` for user-visible behavior/flags/output.
  - `docs/ARCHITECTURE.md` for flow/module changes.
  - `AGENTS.md` when agent workflow or review policy changes.
  - `CONTRIBUTING.md` when contributor expectations change.
- Preserve backwards-compatible CLI behavior unless requested.
- Before merge, validate:
  - Formatting passes (`deno task fmt`).
  - Tests pass (`deno test`).
  - The main flow runs for affected provider(s).
  - Docs are updated for changed flags/env vars/behavior.

## Review Checklist Format

When providing reviews, use this order:

1. Bugs and behavioral regressions.
2. Risks and edge cases.
3. Missing tests or validation gaps.
4. Short summary of change quality and readiness.

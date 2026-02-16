# Architecture

## Purpose

This CLI fetches issue activity from GitLab and/or Jira for a time range, then
writes JSON files with matching issues.

## Module Responsibilities

- `main.ts`
  - Entry point.
  - Generates config, computes date range, dispatches provider fetches through
    provider adapters.
  - Writes output files and evaluates run status (`SUCCESS`, `PARTIAL`,
    `FAILED`) with structured exit codes (0, 2, 1).
- `providers/types.ts`
  - Shared adapter contract (`ProviderAdapter`) and provider/date-window types.
- `providers/gitlab_adapter.ts`
  - GitLab adapter implementation for live API fetches or mock fixture mode.
- `providers/jira_adapter.ts`
  - Jira adapter implementation for live API fetches or mock fixture mode.
- `config.ts`
  - Loads `.env`, parses CLI flags, prompts interactively for missing values.
  - Validates required provider inputs.
- `dates.ts`
  - Converts `timeRange` into ISO start/end timestamps.
  - Handles `custom` date parsing (`MM-DD-YYYY`).
- `gitlab.ts`
  - Fetches user, projects, issues, and notes from GitLab API.
  - Applies `my_issues` vs `all_contributions` filtering logic.
- `jira.ts`
  - Builds JQL and fetches issues/comments from Jira API.
  - Applies contribution filtering and null cleanup.
- `types.ts`
  - Shared config and provider issue interfaces.
- `mocks.ts`
  - Loads local fixture files for offline runs when mock mode is enabled.
- `http_client.ts`
  - Shared JSON HTTP client with retry/backoff and `Retry-After` handling for
    429/5xx responses.
- `*_test.ts`
  - Unit and integration-style tests.
  - Current coverage includes date range behavior and provider fetch/filter
    flows with mocked HTTP responses.

## Data Flow

1. `main.ts` calls `generateConfig()` from `config.ts`.
2. `main.ts` calls `getDateRange()` from `dates.ts`.
3. `main.ts` resolves adapters and executes enabled provider adapters.
4. Adapter fetch path:
   - Mock mode: load fixture arrays from `fixtures/*.mock.json`
   - Live mode GitLab adapter -> `gitlabIssues(...)`
   - Live mode Jira adapter -> `jiraIssues(...)`
5. Provider adapter returns filtered issue list.
6. `main.ts` writes JSON output file(s).
7. `main.ts` aggregates provider outcomes and exits with structured status code.

## Provider Differences

- GitLab:
  - Discovers contributed projects first.
  - Uses multiple API routes (`/user`, `/users/:id/contributed_projects`,
    `/projects/:id/issues`, `/notes`).
  - Contributor detection includes author, assignee, and note author.
- Jira:
  - Uses JQL search (`/rest/api/2/search`) plus issue comments endpoint.
  - Contributor detection includes assignee, reporter, watcher in query, plus
    comment author checks.

## Shared Assumptions

- PAT tokens are supplied via env vars, flags, or prompt.
- Date filtering is bounded by computed ISO start/end values.
- Output is raw provider issue JSON plus `notes` for comments.
- No long-term state is persisted beyond output files.
- Provider API failures are explicit errors, not silent partial fetches.
- Transient provider/network failures use shared retry/backoff behavior.

## Validation And Quality Gates

- Formatting: `deno task fmt`
- Tests: `deno test` (or `deno task test`)
- Runtime sanity: `deno run main.ts --help` and provider-path run when behavior
  changes
- Non-trivial code changes must include tests and related documentation updates
  in the same PR.

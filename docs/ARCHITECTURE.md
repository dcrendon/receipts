# Architecture

## Purpose

This CLI fetches issue activity from GitLab, Jira, and/or GitHub for a time
range, then writes JSON files with matching issues under `output/`.

## Module Responsibilities

- `main.ts`
  - Entry point.
  - Routes subcommands (`fetch`, `tui`, `report`, `help`).
  - Orchestrates provider execution for `fetch` and report generation for
    `report`.
  - Writes output files and exits using evaluated run status.
- `core/cli.ts`
  - Resolves command surface for v2 command routing and prints command help.
- `core/run_status.ts`
  - Shared run outcome model (`SUCCESS`, `PARTIAL`, `FAILED`), summary
    evaluation, and exit-code mapping.
- `providers/index.ts`
  - Provider adapter registry/factory used by `main.ts`.
- `providers/provider_meta.ts`
  - Provider display metadata (labels used in logs/output).
- `providers/types.ts`
  - Shared adapter contract (`ProviderAdapter`) and provider/date-window types.
- `providers/gitlab_adapter.ts`
  - GitLab adapter implementation for live API fetches or mock fixture mode.
- `providers/jira_adapter.ts`
  - Jira adapter implementation for live API fetches or mock fixture mode.
- `providers/github_adapter.ts`
  - GitHub adapter implementation for live API fetches or mock fixture mode.
- `config/config.ts`
  - Loads `.env`, parses CLI flags, prompts interactively for missing values.
  - Validates required provider inputs.
- `config/tui.ts`
  - Wizard-style interactive configuration flow (`--tui`).
  - Collects provider/time/fetch/auth options with input validation and
    confirmation.
- `config/dates.ts`
  - Converts `timeRange` into ISO start/end timestamps.
  - Handles `custom` date parsing (`MM-DD-YYYY`).
- `providers/gitlab.ts`
  - Fetches user, projects, issues, and notes from GitLab API.
  - Applies `my_issues` vs `all_contributions` filtering logic.
- `providers/jira.ts`
  - Builds JQL and fetches issues/comments from Jira API.
  - Applies contribution filtering and null cleanup.
- `providers/github.ts`
  - Uses GitHub issue search and comments APIs.
  - Applies `my_issues` / `all_contributions` filtering and metadata enrichment
    (labels, assignees, milestone, repository).
- `shared/types.ts`
  - Shared config and provider issue interfaces.
- `providers/mocks.ts`
  - Loads local fixture files for offline runs when mock mode is enabled.
- `providers/http_client.ts`
  - Shared JSON HTTP client with retry/backoff and `Retry-After` handling for
    429/5xx responses.
- `reporting/reporting.ts`
  - Provider-agnostic normalization and aggregation pipeline.
  - Generates run summary markdown plus normalized JSON report artifacts.
- `tests/**/*.ts`
  - Unit and integration-style tests.
  - Current coverage includes date range behavior and provider fetch/filter
    flows with mocked HTTP responses.

## Data Flow

1. `main.ts` resolves command via `core/cli.ts`.
2. For `fetch`/`tui`, `main.ts` calls `generateConfig()` from
   `config/config.ts`.
3. `main.ts` calls `getDateRange()` from `config/dates.ts`.
4. `main.ts` gets adapters from `providers/index.ts` and executes enabled
   provider adapters.
5. Adapter fetch path:
   - Mock mode: load fixture arrays from `fixtures/*.mock.json`
   - Live mode GitLab adapter -> `providers/gitlab.ts` (`gitlabIssues(...)`)
   - Live mode Jira adapter -> `providers/jira.ts` (`jiraIssues(...)`)
   - Live mode GitHub adapter -> `providers/github.ts` (`githubIssues(...)`)
6. Provider adapter returns filtered issue list.
7. `main.ts` writes provider JSON output file(s) under `output/`.
8. Reporting pipeline normalizes and aggregates successful provider issues.
9. `main.ts` writes report artifacts (`output/reports/*-summary.md`,
   `output/reports/*-normalized.json`).
10. `main.ts` aggregates provider outcomes and exits with structured status
    code.

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
- GitHub:
  - Uses issue search (`/search/issues`) plus issue comments endpoint.
  - Contributor detection includes author/assignee/involves search qualifiers.
  - Metadata enrichment includes repository, labels, assignees, and milestone.

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

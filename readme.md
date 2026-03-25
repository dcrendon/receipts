# Receipts

A Deno CLI that aggregates your issue activity across GitLab, Jira, and GitHub, then generates a self-contained HTML report with an AI narrative — so your standup actually reflects everything you shipped.

## What it does

1. Fetches issues and comments from one or more providers over a configurable time range
2. Normalizes them into a unified format with attribution (authored, assigned, commented)
3. Calls the Gemini API to generate a narrative — themes, accomplishments, and a standup-ready summary
4. Writes a self-contained HTML report and a normalized JSON file to `output/`

**`GEMINI_API_KEY` is required.** The tool will not run without it.

## Requirements

- [Deno](https://deno.land/) v1.40+
- A [Google AI Studio](https://aistudio.google.com/apikey) API key (`GEMINI_API_KEY`)
- Credentials for at least one provider

## Setup

```sh
cp .env.example .env
# Edit .env with your credentials
deno run --allow-net --allow-env --allow-read --allow-write main.ts
```

## Configuration

All configuration is via `.env`. When run interactively in a terminal, a setup wizard will prompt for missing credentials and confirm before running.

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Google AI Studio API key |
| `PROVIDER` | No | `gitlab`, `jira`, `github`, or `all` (default: `all`) |
| `TIME_RANGE` | No | `week`, `month`, `year`, or `custom` (default: `week`) |
| `START_DATE` | When `TIME_RANGE=custom` | Start date — `MM-DD-YYYY` |
| `END_DATE` | When `TIME_RANGE=custom` | End date — `MM-DD-YYYY` |
| `GITLAB_PAT` | GitLab | Personal access token |
| `GITLAB_URL` | GitLab | Instance URL (e.g. `https://gitlab.com`) |
| `GITLAB_USERNAME` | No | Username for issue/comment attribution |
| `JIRA_PAT` | Jira | Personal access token |
| `JIRA_URL` | Jira | Instance URL (e.g. `https://jira.example.com`) |
| `JIRA_USERNAME` | Jira | Username for attribution |
| `GITHUB_PAT` | GitHub | Personal access token |
| `GITHUB_URL` | GitHub | API URL (default: `https://api.github.com`) |
| `GITHUB_USERNAME` | GitHub | Username for attribution |

A provider runs only when all its required fields are present. Missing providers are skipped automatically.

## Output

Files are written to `output/` and named by date range and provider:

- `<start>_to_<end>_<providers>-summary.html` — open in any browser
- `<start>_to_<end>_<providers>-normalized.json` — normalized issue data

Each run replaces the previous output files.

## Report sections

1. **Header** — date range, provider badges, generated timestamp
2. **AI Narrative** — themes, accomplishments, and standup summary from Gemini
3. **KPI Cards** — total issues by state (completed / active / blocked) and by provider
4. **Activity Timeline** — comment activity grouped by date, sorted newest first
5. **Issues by Project** — cards grouped by project with state badge, labels, assignees, and description excerpt

## Development

```sh
deno task test   # run all tests
deno task fmt    # format code
deno task dev    # run with file watching
```

## Exit codes

| Code | Meaning |
|---|---|
| 0 | All runnable providers succeeded |
| 1 | No runnable providers, config error, or missing `GEMINI_API_KEY` |
| 2 | Partial success — some providers failed |

## Project structure

```
main.ts                   entry point — config guard, fetch, report
config/
  config.ts               env loading and config assembly
  tui.ts                  interactive setup wizard
  provider_readiness.ts   credential validation per provider
providers/
  gitlab.ts               GitLab API fetcher
  jira.ts                 Jira API fetcher
  github.ts               GitHub API fetcher
reporting/
  normalizer.ts           issue normalization, types, report summary
  narrative.ts            Gemini API — returns themes/accomplishments/summary
  renderer.ts             self-contained HTML template, inline CSS
  reporting.ts            orchestrator: normalize → summarize → narrate → render
shared/
  types.ts                shared interfaces (Config, provider raw types)
```

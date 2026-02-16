# GitLab & Jira Issue Fetcher

A Deno CLI tool to fetch and export GitLab and Jira issues you've worked on. It
scans issues and generates a JSON report of issues where you are the author,
assignee, or a participant.

## Features

- **Multi-Provider**: Supports both GitLab and Jira.
- **Auto-Discovery**: Finds your contributions through provider APIs.
- **Flexible Config**: Use `.env`, command-line flags, or interactive prompts.
- **Resilient Fetching**: Shared retry/backoff for transient API failures and
  rate limits.
- **Smart Filtering**:
  - `my_issues`: only issues you created or are assigned to.
  - `all_contributions`: includes issues where you commented/participated.

## Developer Quickstart

### Prerequisites

- [Deno](https://deno.com/)
- A Personal Access Token (PAT) for GitLab or Jira.

### Setup

```bash
git clone git@github.com:dcrendon/gitlab-issues.git
cd gitlab-issues
cp .env.example .env
```

Edit `.env` with your provider URL/token values, then run:

```bash
deno run main.ts
```

### Development Commands

```bash
# run CLI
deno run main.ts

# watch mode
deno task dev

# format source
deno task fmt

# run tests
deno test
# or
deno task test

# current flags/help
deno run main.ts --help

# offline run with local fixtures (no provider credentials required)
deno run --allow-read --allow-env main.ts --provider all --mock
```

### Expected Outputs

- `provider=gitlab`: writes `gitlab_issues.json` (or `OUT_FILE`).
- `provider=jira`: writes `jira_issues.json` (or `OUT_FILE`).
- `provider=all`: writes both `gitlab_issues.json` and `jira_issues.json`.

### Exit Codes

- `0`: `SUCCESS` (all requested providers completed successfully)
- `1`: `FAILED` (all requested providers failed)
- `2`: `PARTIAL` (some providers succeeded, some failed)

In non-interactive environments (CI/scripts), the CLI exits immediately without
waiting for an Enter key prompt.

## Collaboration Docs

- Repo workflow and acceptance standards: `CONTRIBUTING.md`
- Agent and reviewer operating rules: `AGENTS.md`
- System/module map: `docs/ARCHITECTURE.md`

## Quality Gates

For non-trivial changes, this repository requires:

- code changes,
- tests covering new behavior and key failure paths,
- documentation/policy updates in the same PR when behavior or process changes.

Minimum validation before merge:

- `deno task fmt`
- `deno test` (or `deno task test`)
- `deno run main.ts --help`
- representative provider run when behavior changes

## Quick Start (Windows App)

If preferred, you can run the app directly with the pre-compiled executable.

1. Download the latest `issue-fetcher.exe` from Releases.
2. Generate a PAT for your provider (GitLab or Jira).
3. See [CLI Flags](#cli-flags) for options.
4. Double-click the `.exe` file to run it.
5. Follow the prompts (provider, URL, token).
6. Find `gitlab_issues.json` or `jira_issues.json` next to the app.

## Usage

Run directly in CLI:

```bash
deno run main.ts
```

If `.env` and flags are missing, the tool prompts for required values. When
`--mock`/`--useMockData` is enabled, provider API calls are skipped and fixture
files are used instead.

### CLI Flags

You can override defaults or environment variables using flags:

| Flag             | Alias     | Description                                                                 | Default               |
| :--------------- | :-------- | :-------------------------------------------------------------------------- | :-------------------- |
| `--provider`     |           | Provider to use (`gitlab`, `jira`, `all`)                                   | `gitlab`              |
| `--gitlabPAT`    | `--pat`   | GitLab Personal Access Token                                                | _Interactive_         |
| `--gitlabURL`    | `--url`   | GitLab instance URL                                                         | _Interactive_         |
| `--jiraPAT`      |           | Jira Personal Access Token                                                  | _Interactive_         |
| `--jiraURL`      |           | Jira instance URL                                                           | _Interactive_         |
| `--jiraUsername` |           | Jira username (for JQL queries)                                             | _Interactive_         |
| `--outFile`      | `--out`   | Output filename                                                             | `gitlab_issues.json`* |
| `--timeRange`    | `--range` | `week`, `month`, `year`, `custom`                                           | `week`                |
| `--startDate`    | `--start` | Custom start date (`MM-DD-YYYY`), required for `custom`                     | N/A                   |
| `--endDate`      | `--end`   | Custom end date (`MM-DD-YYYY`), required for `custom`                       | N/A                   |
| `--fetchMode`    | `--mode`  | `my_issues`, `all_contributions`                                            | `all_contributions`   |
| `--useMockData`  | `--mock`  | Use local fixture files instead of provider APIs                            | `false`               |
| `--mockDataDir`  |           | Fixture directory path (`gitlab_issues.mock.json`, `jira_issues.mock.json`) | `fixtures`            |
| `--help`         | `-h`      | Show help message                                                           | N/A                   |

\* Default output filename depends on provider. With `--provider all`, the tool
writes both `gitlab_issues.json` and `jira_issues.json`.

### Examples

```bash
# GitLab
deno run main.ts --range month --mode my_issues --out monthly_report.json

# Jira
deno run main.ts --provider jira --jiraURL https://my.jira.com --jiraUsername myuser --range week

# Both
deno run main.ts --provider all --range week

# Offline local run (uses fixtures/*.mock.json)
deno run --allow-read --allow-env main.ts --provider all --mock
```

## Troubleshooting

- Authentication error (401/403):
  - Verify PAT validity/scopes for selected provider.
  - Confirm URL base matches your instance.
- Rate limit/transient API errors:
  - The CLI retries 429/5xx responses with backoff automatically.
  - If failures persist, rerun later or narrow time range to reduce API load.
- Invalid custom date:
  - Use `MM-DD-YYYY` format for `START_DATE`/`END_DATE` or `--start`/`--end`.
- Empty output:
  - Widen `TIME_RANGE`.
  - Switch `FETCH_MODE` to `all_contributions`.
  - Confirm username (Jira) and account access to projects/issues.

## Security Notes

- Never commit `.env` or tokens.
- Keep tokens in `.env` locally or pass by CLI at runtime.
- Do not paste PAT values in issues, PRs, logs, or screenshots.

## Output

The CLI writes raw provider issue data as JSON, including issue comments/notes
used for contribution filtering.

# GitLab & Jira Issue Fetcher

A Deno CLI tool to fetch and export GitLab and Jira issues you've worked on. It scans
issues and generates a JSON report of issues where you are the author, assignee,
or a participant.

## Features

- **Multi-Provider**: Supports both GitLab and Jira.
- **Auto-Discovery**: Automatically finds your contributions.
- **Flexible Config**: Use a `.env` file, command-line flags, or interactive
  prompts.
- **Smart Filtering**:
  - `my_issues`: Only issues you created or are assigned to.
  - `all_contributions`: Includes issues where you commented/participated, even
    if not assigned.

## Quick Start (Windows App)

If prefered you can run the app directly with the pre-compiled execuatable

1. **Download** the latest `issue-fetcher.exe` from the **Releases** section.
2. **Generate a PAT** for your provider (GitLab or Jira).
3. See [CLI Flags](#cli-flags) section for the full list of options
4. **Double-click** the `.exe` file to run it.
5. **Follow the prompts** on the screen. It will ask for your Provider, URL and
   Token if you haven't set them up beforehand.
6. Once it finishes, look for a new file named `gitlab_issues.json` or `jira_issues.json` right next
   to the app.

## Prerequisites

- [Deno](https://deno.com/)
- A Personal Access Token (PAT) for GitLab or Jira.

## Setup

1. **Clone the repository:**
   ```bash
   git clone git@github.com:dcrendon/gitlab-issues.git
   cd gitlab-issues
   ```

2. **Environment Variables (Optional):** You can create a `.env` file in the
   root directory to save your credentials.
   ```env
   # Common
   PROVIDER=gitlab # or jira
   OUT_FILE=issues.json
   TIME_RANGE=week
   FETCH_MODE=all_contributions

   # GitLab
   GITLAB_PAT=your_gitlab_token
   GITLAB_URL=https://gitlab.com

   # Jira
   JIRA_PAT=your_jira_token
   JIRA_URL=https://jira.example.com
   JIRA_USERNAME=your_username
   ```

## Usage

You can run the tool directly in the CLI:

```bash
deno run main.ts
```

If you haven't set up a `.env` file or provided flags, the tool will
interactively ask for your details.

### CLI Flags

You can override defaults or environment variables using flags:

| Flag             | Alias     | Description                                              | Default              |
| :--------------- | :-------- | :------------------------------------------------------- | :------------------- |
| `--provider`     |           | Provider to use (`gitlab`, `jira`, `all`)                | `gitlab`             |
| `--gitlabPAT`    | `--pat`   | Your GitLab Personal Access Token                        | _Interactive_        |
| `--gitlabURL`    | `--url`   | GitLab instance URL                                      | _Interactive_        |
| `--jiraPAT`      |           | Your Jira Personal Access Token                          | _Interactive_        |
| `--jiraURL`      |           | Jira instance URL                                        | _Interactive_        |
| `--jiraUsername` |           | Jira Username (for JQL queries)                          | _Interactive_        |
| `--outFile`      | `--out`   | Filename for the JSON output                             | `provider_issues.json` |
| `--timeRange`    | `--range` | Time period to scan (`week`, `month`, `year`, `custom`)  | `week`               |
| `--startDate`    | `--start` | Custom start date (`MM-DD-YYYY`) - Required for `custom` | N/A                  |
| `--endDate`      | `--end`   | Custom end date (`MM-DD-YYYY`) - Required for `custom`   | N/A                  |
| `--fetchMode`    | `--mode`  | Scan logic (`my_issues`, `all_contributions`)            | `all_contributions`  |
| `--help`         | `-h`      | Show help message                                        | N/A                  |

**Example:**

```bash
# GitLab
deno run main.ts --range month --mode my_issues --out monthly_report.json

# Jira
deno run main.ts --provider jira --jiraURL https://my.jira.com --jiraUsername myuser --range week

# Both
deno run main.ts --provider all --range week
```

## Output

The script generates a JSON file containing the raw issue data from the provider.

# Vite + shadcn Report Renderer

This project renders HTML reports through a real Vite + React + shadcn package
workspace at `reporting/shadcn-renderer`.

## Why this exists

- Keep the CLI UX simple (`fetch` / `report` stay one command).
- Use real shadcn component code, not CSS-only imitation.
- Keep the report UI maintainable as a dedicated UI workspace.

## Runtime flow

1. Deno CLI normalizes provider issues and builds summary/narrative data.
2. Report generation checks renderer readiness in `reporting/reporting.ts`:
   - Ensures `reporting/shadcn-renderer/package.json` exists.
   - Ensures npm run permission is available.
   - Auto-installs dependencies if `node_modules` is missing.
   - Auto-builds Vite SSR bundle if `dist/server/entry-server.js` is missing.
3. Deno runs `npm --prefix reporting/shadcn-renderer run --silent render`.
4. Payload JSON is streamed to stdin and SSR HTML is read from stdout.
5. CLI writes output files to `output/reports/`.

If the renderer workspace cannot be read, npm permission is missing, or renderer
build/run fails, report generation errors immediately.

## Output formats

The `reportFormat` option controls which files are written:

| Format       | Files written                        |
|--------------|--------------------------------------|
| `html`       | `.html` only                         |
| `markdown`   | `.md` only                           |
| `both`       | `.html` and `.md`                    |

### File naming

Output files use descriptive names derived from the report date window and
active providers:

```
2026-02-01_to_2026-02-16_github-gitlab-summary.html
2026-02-01_to_2026-02-16_github-gitlab-summary.md
```

## HTML report sections

The shadcn SSR renderer produces a single-page HTML report with 10 sections:

| #  | Section                    | Description                                              |
|----|----------------------------|----------------------------------------------------------|
| 1  | Header card                | Date window, executive headline, AI-assisted badge       |
| 2  | KPI grid                   | Completed / Active / Blocked counts, contribution stats  |
| 3  | Provider distribution      | Issue counts per provider (GitLab, Jira, GitHub)         |
| 4  | Top activity highlights    | Issue cards with impact chip, bucket badge, labels       |
| 5  | Collaboration highlights   | Authored / assigned / commented contribution lines       |
| 6  | Risks and follow-ups       | Blocked items, stale issues, items needing attention     |
| 7  | Weekly talking points      | Data-driven stand-up / retro discussion prompts          |
| 8  | Impact legend              | Explains impact score components and ranges              |
| 9  | Appendix table             | Full issue list (11 columns) sorted by impact score      |
| 10 | Coverage footer            | Source mode, connected providers, partial failure count   |

### Theme support

The report supports both light and dark themes via CSS `prefers-color-scheme`.
Light theme is the default; dark theme activates automatically based on the
viewer's OS preference. Both themes use oklch color values defined as CSS custom
properties in `styles.css`.

## Renderer workspace layout

- `reporting/shadcn-renderer/package.json`
  - CLI-facing scripts (`build`, `build:server`, `render`).
- `reporting/shadcn-renderer/vite.config.ts`
  - Vite SSR configuration for the server renderer bundle.
- `reporting/shadcn-renderer/src/entry-server.tsx`
  - SSR entry; reads JSON from stdin and emits full HTML document.
  - Contains all section components in a single file (~580 lines).
- `reporting/shadcn-renderer/src/styles.css`
  - Tailwind CSS v4 import, light/dark theme custom properties, base styles.

## Local development notes

- Pre-build manually (optional):
  - `npm --prefix reporting/shadcn-renderer install`
  - `npm --prefix reporting/shadcn-renderer run build`
- Normal CLI commands still trigger bootstrap automatically when needed.
- To test the renderer in isolation:
  ```sh
  echo '{"normalizedIssues":[],"summary":{},...}' | \
    npm --prefix reporting/shadcn-renderer run --silent render
  ```

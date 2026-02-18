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
5. CLI writes `output/reports/*-summary.html`.

If the renderer workspace cannot be read, npm permission is missing, or renderer
build/run fails, report generation now errors immediately instead of silently
falling back to a different HTML renderer.

## Renderer workspace layout

- `reporting/shadcn-renderer/package.json`
  - CLI-facing scripts (`build`, `build:server`, `render`).
- `reporting/shadcn-renderer/vite.config.ts`
  - Vite SSR configuration for the server renderer bundle.
- `reporting/shadcn-renderer/src/entry-server.tsx`
  - SSR entry; reads JSON from stdin and emits full HTML document.

## Local development notes

- Pre-build manually (optional):
  - `npm --prefix reporting/shadcn-renderer install`
  - `npm --prefix reporting/shadcn-renderer run build`
- Normal CLI commands still trigger bootstrap automatically when needed.

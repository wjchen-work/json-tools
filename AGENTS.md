# AGENTS.md

Single-page Vue 3 + TypeScript + Vite app: a Monaco-based JSON formatter / validator. No backend, no tests. One route (`/`) rendering `src/views/JsonToolView.vue`.

## Commands

Package manager is **pnpm** (`pnpm-lock.yaml` is the source of truth). Node `^22.18.0 || >=24.12.0`.

- `pnpm install` — install deps
- `pnpm dev` — Vite dev server
- `pnpm type-check` — `vue-tsc --build` (not `tsc`; needed for `.vue` types)
- `pnpm build` — runs `type-check` **and** `build-only` in parallel via `run-p`; use `pnpm build-only` for a fast bundle without type checking
- `pnpm lint` — `run-s` runs `oxlint . --fix`, then `eslint . --fix --cache`; both auto-fix
- `pnpm format` — `oxfmt src/` **only** (root config files are not formatted)

There is no test runner or test script. Do not try to run `pnpm test`. Verify UI changes manually; `opencode.json` (gitignored) wires a `chrome-devtools-mcp` server for that.

## Style quirks

- `.oxfmtrc.json`: `semi: false`, `singleQuote: true`. `.editorconfig`: 2-space indent, LF, final newline, max line 100.
- `.gitattributes` forces LF for all files; the Monaco models pin EOL to LF via `setEOL(...LF)` in the editor components.
- Lint rules live in `.oxlintrc.json`; `eslint.config.ts` pulls them in with `pluginOxlint.buildFromOxlintConfigFile`. Change the oxlint config, not the generated ESLint layer.
- `noUncheckedIndexedAccess` is on (`tsconfig.app.json`) — indexed access is `T | undefined`. `@` aliases `src/` in both Vite and tsconfig.

## Architecture

Three composition-style Pinia stores; there is no single god store.

- `src/utils/json.ts` — all parsing / analysis / formatting / minifying / tree / table projection. Built on `jsonc-parser`, never `JSON.parse`.
- `src/utils/schema.ts` — reads the root `$schema` leniently (a document with syntax errors still surfaces it) and strictly parses schema content.
- `src/stores/jsonDocument.ts` — the edited document, indent, theme, cursor, derived `analysis`/`tree`/`stats`/`issues`, plus format/minify/sample/notify actions. Debounce-persists `text` to `localStorage`; the sample only loads when nothing is stored.
- `src/stores/schemaSupport.ts` — `$schema` support: detects the reference, fetches remote schemas, and keeps user-supplied URL→content mappings (also persisted). Network fetching lives here, not in Monaco.
- `src/stores/listView.ts` — bottom "列表查看" drawer state (one tab per opened array).
- `src/monaco/setup.ts` — one-time worker/theme/provider registration (idempotent). Providers: `completion.ts`, `theme.ts`, `schema.ts`. Model URIs are shared from `uri.ts` (`DOCUMENT_URI`, `SCHEMA_EDITOR_URI`).
- `src/components/MonacoJsonEditor.vue` — owns the main Monaco instance and two-way-binds it to the store; `import()`s `monaco-editor` in `onMounted` to keep it out of the main chunk. `SchemaPanel.vue` lazily creates a second editor for mapping content.
- `src/views/JsonToolView.vue` — toolbar, side panels (结构 / 问题), status bar; mounts `SchemaPanel` and `ListViewPanel`.

## Non-obvious constraints (don't regress)

- **Strict JSON only.** `STRICT_JSON_OPTIONS` disallows comments and trailing commas; the "问题" panel and editor squiggles depend on it. Schema mapping content is parsed separately by `parseSchemaDocument` (also strict).
- **Formatting must preserve key order and number-literal spelling** (`1.0`, `1e3`, oversized integers). `formatJson` uses `jsonc-parser`'s `format` + `applyEdits` for exactly this reason. Never re-implement with `JSON.parse`/`JSON.stringify`.
- Monaco's built-in JSON diagnostics are intentionally disabled in `setup.ts`; syntax errors come solely from `jsonc-parser` via the store, so squiggles and the problem list agree and stay localized. Schemas are registered inline with `enableSchemaRequest: false`, and fetch failures become warnings with a "手动填写 $schema 内容" quick fix (`monaco/schema.ts`).
- UI strings, samples, error messages and most comments are **Chinese**. Keep new user-facing text Chinese and match the existing tone.

## CI / release

No workflow runs on PRs; both are deploy-only.

- `.github/workflows/pages.yml` — on push to `master`, builds with `VITE_BASE_PATH` (default `/json-tools/`) and deploys `dist/` to GitHub Pages via Actions artifacts.
- `.github/workflows/release.yml` — on pushing a `v*` tag, builds with the default base `/`, zips `dist/`, and creates a GitHub Release.

`vite.config.ts` reads `process.env.VITE_BASE_PATH` for `base`; leave it unset for a root-relative build.

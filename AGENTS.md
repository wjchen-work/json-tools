# AGENTS.md

Single-page Vue 3 + TypeScript + Vite app: a Monaco-based JSON formatter / validator. No backend, no tests, one route (`/`) rendering `src/views/JsonToolView.vue`. All app state lives in one Pinia store.

## Commands

Package manager is **pnpm** (`pnpm-lock.yaml` is the source of truth). Node `^22.18.0 || >=24.12.0`.

- `pnpm install` — install deps
- `pnpm dev` — Vite dev server
- `pnpm type-check` — `vue-tsc --build` (not `tsc`; needed for `.vue` types)
- `pnpm build` — runs `type-check` **and** `build-only` in parallel via `run-p`; use `pnpm build-only` for a fast bundle without type checking
- `pnpm lint` — runs `oxlint --fix` then `eslint --fix --cache`, sequentially; both auto-fix
- `pnpm format` — `oxfmt src/` **only** (root config files are not formatted)

There is no test runner or test script. Do not try to run `pnpm test`.

## Style quirks

- `.oxfmtrc.json`: `semi: false`, `singleQuote: true`. `.editorconfig`: 2-space indent, LF, final newline, max line 100.
- `.gitattributes` forces LF for all files; the Monaco model EOL is pinned to LF in `MonacoJsonEditor.vue`.
- ESLint is layered on oxlint (`eslint-plugin-oxlint`); don't hand-edit the generated config.
- `noUncheckedIndexedAccess` is on (`tsconfig.app.json`) — indexed access is `T | undefined`. `@` aliases `src/` in both Vite and tsconfig.

## Architecture

- `src/utils/json.ts` — all parsing / analysis / formatting / minifying. Built on `jsonc-parser`, never `JSON.parse`.
- `src/stores/jsonDocument.ts` — the single composition-style store (`text`, `indent`, `theme`, cursor, derived `analysis`/`tree`/`stats`/`issues`). The editor and panels both read/write here.
- `src/monaco/setup.ts` — one-time worker/theme/provider registration (idempotent). `completion.ts` and `theme.ts` are its providers.
- `src/components/MonacoJsonEditor.vue` — owns the Monaco instance and two-way-binds it to the store; `import()`s `monaco-editor` in `onMounted` to keep it out of the main chunk.
- `src/views/JsonToolView.vue` — toolbar, side panels, status bar.

## Non-obvious constraints (don't regress)

- **Strict JSON only.** `STRICT_JSON_OPTIONS` disallows comments and trailing commas; the "问题" panel and editor squiggles depend on it.
- **Formatting must preserve key order and number-literal spelling** (`1.0`, `1e3`, oversized integers). `formatJson` uses `jsonc-parser`'s `format` + `applyEdits` for exactly this reason. Never re-implement with `JSON.parse`/`JSON.stringify`.
- Monaco's built-in JSON diagnostics are intentionally disabled in `setup.ts`; syntax errors come solely from `jsonc-parser` via the store, so squiggles and the problem list agree and stay localized.
- UI strings, samples, error messages and most comments are **Chinese**. Keep new user-facing text Chinese and match the existing tone.

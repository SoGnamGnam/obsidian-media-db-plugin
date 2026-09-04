# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An Obsidian plugin that queries multiple media metadata APIs (movies, series, anime, manga, books, comics, games, music, boardgames, wiki) and imports the results as notes into an Obsidian vault. The built artifact is a single `main.js` at the repo root, loaded by Obsidian alongside `manifest.json` and `styles.css`.

## Commands

The toolchain is **Bun** (package manager, test runner) + **Vite/rolldown** (bundler). There is no npm/yarn lockfile — use `bun`.

- `bun run dev` — watch build into `exampleVault/.obsidian/plugins/…` for live testing in the example vault.
- `bun run build` — production build (`tsc` typecheck + Vite prod bundle into `dist/`).
- `bun run typecheck` — typechecks both `tsconfig.json` (source) and `tests/tsconfig.json`.
- `bun run test` — runs all tests via `bun test --preload ./tests/setup.ts`.
- Run a single test file: `bun test --preload ./tests/setup.ts tests/utils.test.ts`
- `bun run test:log` — same, with `LOG_TESTS=true` (enables Logger output during tests).
- `bun run lint` / `bun run lint:fix` — ESLint over `packages/obsidian/src/**` (max-warnings=0).
- `bun run check` — the full gate: `format:check && typecheck && lint && test:log`. Run this before considering work done. `bun run check:fix` auto-formats/fixes first.

## Repository layout

This is a workspace with two packages under `packages/`:

- `packages/obsidian/src/` — all plugin code. This is the only thing linted and the tsconfig `include`.
- `packages/schemas/src/` — **auto-generated** OpenAPI types (`openapi-typescript`) for TMDB, MAL, OpenLibrary. Do not hand-edit these; they carry a "Do not make direct changes" header.

Imports use **absolute paths** from the `packages` alias (e.g. `import { APIModel } from 'packages/obsidian/src/api/APIModel'`), configured in `vite.config.mts` and `tsconfig.json`. Relative imports are an ESLint error (`no-relative-import-paths`) — even same-folder. `consistent-type-imports` is enforced, so use `import type` for type-only imports.

## Architecture

**Plugin entry** (`main.ts`): `MediaDbPlugin` wires up a set of singleton helpers (`APIManager`, `MediaTypeManager`, `PropertyMapper`, `ModalHelper`, `MediaDbFileHelper`, `MediaDbEntryHelper`, `BulkImportHelper`, `DateFormatter`, `ErrorReporter`), registers every API, and registers commands + the ribbon/file-menu entries. `registerCommands` generates a per-media-type "Create entry" command by iterating `MEDIA_TYPES`.

**APIs** (`api/`): Each source extends the abstract `APIModel` (`searchByTitle`, `getById`, `getDisabledMediaTypes`; optional `getSeasonsForSeries` for season-capable APIs, checked via `isSeasonListAPIModel`). Each declares `apiName`, `apiUrl`, `apiDescription`, and the `MediaType[]` it serves. APIs are instantiated and registered in `main.ts` `registerDefaultApis()`; `APIManager` is just a registry that fans a query out across the selected APIs in parallel and merges results. **To add an API:** create the class in `api/apis/`, register it in `registerDefaultApis()`.

**Models** (`models/`): Each media type has a model extending abstract `MediaTypeModel` (`getMediaType`, `getSummary`, `getTags`, plus `toMetaDataObject()` which becomes note frontmatter). `MediaType` (`utils/MediaType.ts`) is the canonical enum; `MediaTypeManager.createMediaTypeModelFromMediaType()` maps a `MediaType` to its concrete model constructor. When adding a media type you touch: the `MediaType` enum, a new model, the factory switch in `MediaTypeManager`, the template/folder/filename maps in `MediaTypeManager.updateTemplates/updateFolders`, and `Settings`.

**Error handling** is `Result`/`Outcome`-based, not exceptions. `utils/result.ts` defines `Result<T,E>` with `ok`/`err` and combinators (`mapResult`, `andThen`, `fromPromise`, …), plus an `Outcome` type with Ok/Cancelled/Skipped/Error for user-cancellable flows (bulk import). API methods return `Promise<Result<…, MDBError>>`. `MDBError` (`utils/MDBError.ts`) has a `kind`, an internal `message`, and a `userMessage`; build them with `toMdbError`.

**Secrets**: API keys are stored via Obsidian's `app.secretStorage` (referenced by a settings key id like `settings.TMDBKeyId`), not in plain settings. Legacy plain-text keys in older settings are detected on load and migrated through `LegacyApiKeysModal` (`LEGACY_API_KEY_SETTINGS` in `Settings.ts`).

**UI flow**: `ModalHelper`/`MediaDbEntryHelper` drive the search → select-result → create-note pipeline through the `modals/`. `MediaTypeManager` resolves the target folder, filename template, and body template per media type; `replaceTags` (`utils/Utils.ts`) does the `{{ title }}` / `{{ LIST:x }}` / `{{ ENUM:x }}` substitution. `PropertyMapper` applies the user's default/remap/remove frontmatter field mappings.

**Logging**: Use the `Logger` (`utils/Logger.ts`). Log level is compiled in via the Vite `__LOG_LEVEL__` define (2 in prod = warnings/errors only, 4 in dev).

## Testing

Tests live in `tests/` and run under Bun with **happy-dom** and a hand-rolled `obsidian` module mock in `tests/setup.ts` (preloaded). Because `obsidian` is mocked, only the classes/functions listed in that mock are available in tests — extend the mock in `setup.ts` when a test needs another Obsidian export. Tests import source via the same `packages/*` alias.

## Release

Releases are automated via `@lemons_dev/lemons-obsidian-plugin-automation` (`bun run release`), configured in `repo-automation.config.json`: dev branch `master`, release branch `release`. The README on `master` describes the in-development version; the release branch README describes the published one. Preconditions (typecheck/format/lint/test) run before a release.

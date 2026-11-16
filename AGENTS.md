# AGENTS.md

## Project

Payload is a local API tester built with Tauri 2, React 19, TypeScript, Vite, Tailwind CSS 4, and Zustand. Use Bun for JavaScript tooling (`bun.lock` is the lockfile).

## Structure

- `src/`: React frontend; feature components are under `src/components/`.
- `src/store/`: Zustand state, persistence, and storage migrations.
- `src/lib/`: Request building, API/IPC integration, cURL, variables, and utilities.
- `src-tauri/src/`: Rust backend for HTTP execution, cookies, cancellation, and file/workspace storage.
- `scripts/mock-server.mjs`: Local mock API server for manual testing.

## Important constraints

- Requests and persistence cross the TypeScript/Rust IPC boundary. Keep `src/types.ts`, `src/lib/api.ts`, `src-tauri/src/models.rs`, and related command handlers in sync when changing their contracts.
- Preserve persisted-data compatibility; update `src/store/migrate.ts` when changing stored shapes.
- TypeScript is strict, with unused locals/parameters treated as errors.
- Prefer existing UI SDK, Lucide, and CodeMirror dependencies over adding alternatives.
- Do not edit generated output in `dist/`, `src-tauri/target/`, or `src-tauri/gen/`.

## Commands

- Web development: `bun run dev` (port 1420).
- Desktop development: `bun run tauri dev`.
- Frontend build/typecheck: `bun run build`.
- Tests: `bun run test`.
- Rust check: `cargo check --manifest-path src-tauri/Cargo.toml`.

Tests use Vitest, Testing Library, and jsdom, and are colocated with source as `*.test.ts` or `*.test.tsx`. CodeMirror is stubbed in tests through `vitest.config.ts`.

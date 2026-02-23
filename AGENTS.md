# AGENTS.md

## Commands

- **Dev**: `pnpm dev` - runs Vite frontend + Node server concurrently
- **Typecheck**: `pnpm typecheck` - checks frontend and server
- **Lint**: `pnpm lint` - ESLint
- **Check**: `pnpm check` - format check + lint + typecheck + build
- **Build**: `pnpm build` - builds frontend (Vite) and compiles TypeScript
- **Test**: `pnpm test` - runs Vitest test suite (frontend + server)

## How It Works

This app is a **local web UI for managing Amp threads**. It is NOT part of Amp itself — it reads Amp's local data and calls its CLI/API to provide a dashboard experience.

### Amp Integration (3 mechanisms)

1. **Filesystem (read-only)**: The primary data source. Thread JSON files live at `~/.local/share/amp/threads/T-*.json`. The server reads these directly to list threads, extract messages, calculate costs, and determine workspace/repo info. The `ThreadFile` shape is defined in `server/lib/threadTypes.ts`. **There is no official Amp API documentation** — these file formats were reverse-engineered.

2. **Amp CLI** (`amp` binary): Used for mutations — creating, renaming, archiving, and sharing threads. Located via `AMP_BIN` env var or `~/.local/bin/amp`. Also spawned with `--stream` for live thread execution over WebSocket. See `server/lib/utils.ts` (`runAmp`) and `server/websocket.ts`.

3. **Amp Internal API** (`ampcode.com/api/internal`): Used for features not available via CLI — fetching/setting labels, remote thread deletion. Auth token read from `~/.local/share/amp/secrets.json`, config from `~/.config/amp/settings.json`. See `server/lib/amp-api.ts`. This is an **undocumented internal API** — methods were discovered by inspecting Amp's behavior.

### Data Model & Where Logic Lives

**Server is the authority for thread data.** The client is a thin presentation layer.

- **Server** (`server/lib/`):
  - `threadCrud.ts` — reads thread JSON files, transforms raw data into the shared `Thread` type (title extraction, cost calculation, workspace/repo parsing, handoff relationships)
  - `database.ts` — SQLite DB at `~/.amp-thread-manager/threads.db` for **app-specific metadata** not in Amp's files: thread status (active/parked/done/blocked), blockers, goals, linked issues, artifacts
  - `amp-api.ts` — client for Amp's internal API (labels)
  - `workspaces.ts` — discovers workspaces from thread files + `~/Development` git repos
  - Route handlers in `server/routes/` expose REST endpoints

- **Client** (`src/`):
  - `hooks/useThreads.ts` — fetches thread list from server API with polling (30s) and pagination
  - `hooks/useThreadMetadata.ts` — fetches app-specific metadata (statuses, blockers) from server
  - `hooks/useThreadActions.ts` — calls server endpoints for mutations (archive, delete, rename, etc.)
  - `contexts/ThreadContext.tsx` — combines threads + metadata + actions into a single React context
  - `contexts/RunningThreadsContext.tsx` — tracks live thread execution state via WebSocket
  - The client does **no direct file/CLI access** — all data flows through the server's REST API and WebSocket

### Real-time Execution

When a user runs a thread from the UI, the server spawns `amp --stream` as a child process, pipes stdout/stderr through a WebSocket to the client, and parses the streaming JSON to track costs, tool usage, and images in real-time. Sessions survive brief WebSocket disconnects (30s grace period).

## Directory Structure

- **src/**: React 19 frontend with Vite, context providers in `contexts/`, custom hooks in `hooks/`
- **server/**: Node.js backend using raw `http` module, route handlers in `routes/`, WebSocket handlers
  - `server/lib/` thread logic is split: `threadCrud.ts`, `threadSearch.ts`, `threadExport.ts`, `threadChain.ts`
- **shared/**: Cross-boundary types, WebSocket protocol, validation (`validation.ts`), utilities (`utils.ts`, `cost.ts`, `constants.ts`)
- WebSocket for real-time updates; xterm.js + node-pty for shell terminals

## Code Style

- ES modules, TypeScript strict mode
- React: functional components, `lazy()` for modals, `useCallback` for handlers passed as props
- Imports: external packages first, then local (hooks, components, utils)
- Server routes return `true` if handled, `false` to continue chain
- Modals: use `BaseModal` wrapper (provides `role="dialog"`, focus trap, ESC-to-close)
- All inputs must have `aria-label` or associated `<label>`
- State: context providers in `src/contexts/` (Settings, Modal, Thread, ThreadStatus, Unread)
- Shared code: `stripAnsi()`, `generateId()`, `calculateCost()`, constants live in `shared/`
- Tests: co-located `*.test.ts` files, Vitest workspace (frontend=jsdom, server=node)

## .agents/knowledge/ Directory

Plans and temporary files can be stored in `.agents/knowledge/` directories. Review them for context about ongoing work.

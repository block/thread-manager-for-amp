# AGENTS.md

## Commands

- **Dev**: `pnpm dev` - runs Vite frontend + Node server concurrently
- **Typecheck**: `pnpm typecheck` - checks frontend and server
- **Lint**: `pnpm lint` - ESLint
- **Check**: `pnpm check` - lint + typecheck + build
- **Build**: `pnpm build` - builds frontend (Vite) and compiles TypeScript
- **Test**: `pnpm test` - runs Vitest test suite (frontend + server)

## Architecture

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
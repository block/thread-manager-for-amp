# AGENTS.md

## Commands

- **Dev**: `pnpm dev` - runs Vite frontend + Node server concurrently
- **Typecheck**: `pnpm typecheck` - checks frontend and server
- **Lint**: `pnpm lint` - ESLint
- **Check**: `pnpm check` - lint + typecheck + build
- **Build**: `pnpm build` - builds frontend (Vite) and compiles TypeScript

## Architecture

- **src/**: React 19 frontend with Vite, context providers in `contexts/`, custom hooks in `hooks/`
- **server/**: Node.js backend using raw `http` module, route handlers in `routes/`, WebSocket handlers
- **shared/**: Shared TypeScript types and WebSocket protocol definitions
- WebSocket for real-time updates; xterm.js + node-pty for shell terminals

## Code Style

- ES modules, TypeScript strict mode
- React: functional components, `lazy()` for modals, `useCallback` for handlers passed as props
- Imports: external packages first, then local (hooks, components, utils)
- Server routes return `true` if handled, `false` to continue chain

## .agents/knowledge/ Directory

Plans and temporary files can be stored in `.agents/knowledge/` directories. Review them for context about ongoing work.
# Contributing to Thread Manager for Amp

Thank you for your interest in contributing! This project is a local web UI for managing [Amp](https://ampcode.com) coding agent threads.

## Getting Started

### Prerequisites

- **Node.js** 24+ (native modules require compilation)
- **pnpm** 10+ (`npm install -g pnpm`)
- **[Amp CLI](https://ampcode.com)** installed and authenticated

### Setup

```bash
git clone https://github.com/block/thread-manager-for-amp.git
cd thread-manager-for-amp
pnpm install
pnpm dev
```

Open http://localhost:5173

## Development Workflow

1. Fork and clone the repository
2. Create a feature branch: `git checkout -b my-feature`
3. Make your changes
4. Run tests: `pnpm test`
5. Run checks: `pnpm check` (format check + lint + typecheck + build)
6. Commit with a descriptive message
7. Open a pull request

## Project Structure

- **`src/`** — React frontend (Vite)
- **`server/`** — Node.js backend (vanilla HTTP + WebSocket)
- **`shared/`** — Shared TypeScript types between frontend and server

## Code Style

- TypeScript strict mode
- ES modules throughout
- React: functional components with hooks
- No Express — the server uses Node's built-in `http` module
- Server route handlers return `true` if handled, `false` to pass to the next handler
- All modals use `BaseModal` wrapper (`role="dialog"`, focus trap, ESC-to-close)
- All inputs require `aria-label` or associated `<label>`
- Shared utilities (`stripAnsi`, `generateId`, `calculateCost`) live in `shared/`
- Tests are co-located (`*.test.ts` next to source files)

## Adding Features

- **New API endpoint**: Add route handler in `server/routes/`, return `true` if handled
- **New modal**: Use `BaseModal` wrapper, add `aria-label` to inputs
- **New shared utility**: Add to `shared/` with a co-located test file
- **New context**: Add provider in `src/contexts/`, mount in `src/main.tsx`

## Reporting Issues

- Use GitHub Issues for bug reports and feature requests
- Include your Node.js version, OS, and steps to reproduce

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).

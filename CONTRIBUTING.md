# Contributing to Thread Manager for Amp

Thank you for your interest in contributing! This project is a local web UI for managing [Amp](https://ampcode.com) coding agent threads.

## Getting Started

### Prerequisites

- **Node.js** 24+ (native modules require compilation)
- **pnpm** 10+ (`npm install -g pnpm`)
- **[Amp CLI](https://ampcode.com)** installed and authenticated

### Setup

> **External contributors**: You don't have push access to this repo — that's normal for open source! You'll need to **fork first**, then clone your fork. See the workflow below.

1. **Fork the repository** — Click the "Fork" button on [the repo page](https://github.com/block/thread-manager-for-amp), or use the GitHub CLI:

   ```bash
   gh repo fork block/thread-manager-for-amp --clone
   cd thread-manager-for-amp
   ```

2. **Install dependencies and start dev server**:

   ```bash
   pnpm install
   pnpm dev
   ```

3. Open http://localhost:5173

## Development Workflow

1. Make sure your fork is up to date: `git pull upstream main`
2. Create a feature branch: `git checkout -b my-feature`
3. Make your changes
4. Run tests: `pnpm test`
5. Run checks: `pnpm check` (format check + lint + typecheck + build)
6. Commit with a descriptive message
7. Push to your fork: `git push origin my-feature`
8. Open a pull request from your fork back to `block/thread-manager-for-amp`

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

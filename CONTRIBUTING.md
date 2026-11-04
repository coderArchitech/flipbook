# Contributing to Flipbook

Thanks for helping. This guide covers setup, the checks a change must pass, and how to open a pull request.

## Setup

```bash
git clone https://github.com/<owner>/flipbook.git
cd flipbook/flipbook
nvm use            # Node 24 is required (node:sqlite)
npm ci
npm run dev        # editor at http://localhost:5173, API/reader at http://localhost:3000
```

For the full install options, see the [root README](README.md#prerequisites).

## Before you open a pull request

Run these from `flipbook/`. CI runs the same checks on every push and pull request.

```bash
npm test                                       # unit and API integration tests
npx playwright install chromium --only-shell   # one-time
npm run test:e2e                               # browser end-to-end tests
docker compose build                           # the production image still builds
```

If you can't run browsers locally, `./scripts/test.sh` runs the whole suite inside Docker.

## Guidelines

- **Stay consistent with the surrounding code.** The project uses plain JavaScript ES modules and JSX, with no TypeScript and no extra runtime services. Code shared by client and server lives in `flipbook/shared/`.
- **Add or update tests with every behavior change.** Use Vitest for units (`tests/frontend`, `tests/backend`), `node --test` for API and integration tests (`tests/*.test.mjs`), and Playwright for user journeys (`tests/e2e`).
- **Update the documentation when behavior changes.** User-facing features are documented in [flipbook/README.md](flipbook/README.md). Architecture, API and storage changes go in [docs/TECHNICAL_DESIGN.md](docs/TECHNICAL_DESIGN.md). Scope changes go in [docs/PRD.md](docs/PRD.md).
- **Treat security as part of correctness.** Keep per-account isolation, CSRF and origin checks, and the immutability of published editions intact. New dependencies need a reason and must pass `npm audit --omit=dev --audit-level=high`.
- **Never commit generated or private files.** That includes `data/`, `backups/`, `.env`, `dist/` and test reports; `.gitignore` covers them.

## Pull requests

1. Branch from `main`, for example `feature/csv-images` or `fix/pdf-overflow`.
2. Keep each pull request focused on one change, and describe what changed and how you tested it. The PR template prompts for this.
3. CI must pass before merge.

## Reporting bugs and requesting features

Use the issue templates. Report security problems privately as described in [SECURITY.md](SECURITY.md), not in a public issue.

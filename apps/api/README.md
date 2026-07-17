# Backend API README

See the monorepo root [`README.md`](../../README.md) for overview and quick start.

This package is the Express API (`apps/api`).

| Script | Purpose |
|--------|---------|
| `npm run dev` | Watch mode |
| `npm run build` / `npm start` | Compile (includes OpenAPI YAML) + run |
| `npm test` / `npm run test:coverage` | Vitest + MSW |
| `npm run test:firestore` | Emulator DoD (Phases 6/13) |
| `npm run lint` / `npm run typecheck` | CI gates |

Docker: `Dockerfile` + `.dockerignore` in this directory (Phase 18).

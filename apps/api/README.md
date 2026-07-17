# GeoPulse API (`apps/api`)

Express + TypeScript service for the GeoPulse backend. See the repo root
[`README.md`](../../README.md) for overview and quick start.

| Script | Purpose |
|--------|---------|
| `npm run dev` | Watch mode |
| `npm run build` / `npm start` | Compile (includes OpenAPI YAML) + run |
| `npm test` / `npm run test:coverage` | Vitest + MSW |
| `npm run test:firestore` | Emulator DoD |
| `npm run lint` / `npm run typecheck` | CI gates |

Docker: `Dockerfile` in this directory → image tag `geopulse-api`.

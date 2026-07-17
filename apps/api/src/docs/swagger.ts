import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Express, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveOpenApiPath(): string {
  const nextToModule = join(__dirname, 'openapi.yaml');
  if (existsSync(nextToModule)) return nextToModule;
  // Fallback when running from dist/ without copied YAML
  return join(__dirname, '../../src/docs/openapi.yaml');
}

/** Load and parse `openapi.yaml` (Phase 12). Exported for docs tests. */
export function loadOpenApiDocument(): Record<string, unknown> {
  const raw = readFileSync(resolveOpenApiPath(), 'utf8');
  return parseYaml(raw) as Record<string, unknown>;
}

/**
 * Section 9.8 / Phase 12 — mount Swagger UI at /docs and raw spec at /openapi.json.
 */
export function mountSwagger(app: Express): void {
  const document = loadOpenApiDocument();

  app.get('/openapi.json', (_req: Request, res: Response) => {
    res.status(200).json(document);
  });

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(document, { explorer: true }));
}

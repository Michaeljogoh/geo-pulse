import { setupServer } from 'msw/node';

import { handlers } from './handlers.js';

/**
 * Phase 17 — shared MSW server for unit/integration tests.
 */
export const server = setupServer(...handlers);

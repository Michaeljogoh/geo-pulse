import { setupServer } from 'msw/node';

import { ipProviderHandlers } from './handlers.js';

/**
 * Shared MSW server — expand in Phase 17 with market/news handlers.
 */
export const server = setupServer(...ipProviderHandlers);

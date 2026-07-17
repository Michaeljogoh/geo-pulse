import { setupServer } from 'msw/node';

import { coinGeckoHandlers, ipProviderHandlers, newsHandlers } from './handlers.js';

/**
 * Shared MSW server (Phase 17 consolidation target).
 */
export const server = setupServer(...ipProviderHandlers, ...coinGeckoHandlers, ...newsHandlers);

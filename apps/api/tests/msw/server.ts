import { setupServer } from 'msw/node';

import { coinGeckoHandlers, ipProviderHandlers, newsHandlers } from './handlers.js';

/**
 * Shared MSW server for integration and unit tests.
 */
export const server = setupServer(...ipProviderHandlers, ...coinGeckoHandlers, ...newsHandlers);

import pino from 'pino';

import { env } from '../config/env.js';

/** Structured logger. Redacts secrets and API keys from log output. */
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'auth_token',
      'apikey',
      'apiKey',
      'api_key',
      'Authorization',
      'authorization',
      'FIREBASE_PRIVATE_KEY',
      'private_key',
      'CRYPTOCOMPARE_API_KEY',
      'GNEWS_API_KEY',
      'COINGECKO_DEMO_KEY',
      '*.auth_token',
      '*.apikey',
      '*.apiKey',
      '*.authorization',
      'req.headers.authorization',
      'headers.authorization',
      'headers.Authorization',
      'config.headers.authorization',
      'config.headers.Authorization',
      'config.params.auth_token',
      'config.params.apikey',
    ],
    censor: '[Redacted]',
  },
  ...(env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard' },
        },
      }
    : {}),
});

export type Logger = typeof logger;

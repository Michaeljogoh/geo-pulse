import { describe, expect, it } from 'vitest';

import { parseEnv } from '../../src/config/env.js';
import { DEV_AUTH_USER } from '../../src/middleware/auth.js';

describe('AUTH_ENABLED / DEV_AUTH_USER', () => {
  it('documents the fixed local bypass user', () => {
    expect(DEV_AUTH_USER).toEqual({
      uid: 'dev-local-user',
      email: 'dev@localhost',
      name: 'Local Dev User',
      picture: null,
    });
  });

  it('parses AUTH_ENABLED from env', () => {
    const enabled = parseEnv({
      NODE_ENV: 'test',
      CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
      FIREBASE_PROJECT_ID: 'p',
      FIREBASE_CLIENT_EMAIL: 'sa@p.iam.gserviceaccount.com',
      FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nA\\n-----END PRIVATE KEY-----\\n',
      CRYPTOCOMPARE_API_KEY: 't',
      AUTH_ENABLED: 'false',
    });
    expect(enabled.AUTH_ENABLED).toBe(false);
  });
});

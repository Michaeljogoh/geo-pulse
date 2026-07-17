import { describe, expect, it } from 'vitest';

import { parseEnv } from '../../src/config/env.js';

const validRaw: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  PORT: '8080',
  LOG_LEVEL: 'info',
  CORS_ALLOWED_ORIGINS: 'http://localhost:3000,https://app.example.com',
  FIREBASE_PROJECT_ID: 'geopulse',
  FIREBASE_CLIENT_EMAIL: 'sa@geopulse.iam.gserviceaccount.com',
  FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----\\n',
  CRYPTOCOMPARE_API_KEY: 'token',
  CACHE_ENABLED: 'true',
};

describe('parseEnv', () => {
  it('parses a valid environment', () => {
    const env = parseEnv(validRaw);
    expect(env.NODE_ENV).toBe('test');
    expect(env.PORT).toBe(8080);
    expect(env.CORS_ALLOWED_ORIGINS).toEqual([
      'http://localhost:3000',
      'https://app.example.com',
    ]);
    expect(env.FIREBASE_PROJECT_ID).toBe('geopulse');
    expect(env.FIREBASE_PRIVATE_KEY).toContain('\n');
    expect(env.FIREBASE_PRIVATE_KEY).not.toContain('\\n');
    expect(env.CRYPTOCOMPARE_API_KEY).toBe('token');
    expect(env.CACHE_ENABLED).toBe(true);
    expect(env.IP_PROVIDER).toBe('ipapi');
    expect(Object.isFrozen(env)).toBe(true);
  });

  it('throws when FIREBASE_PROJECT_ID is missing', () => {
    const { FIREBASE_PROJECT_ID: _, ...rest } = validRaw;
    expect(() => parseEnv(rest)).toThrow(/FIREBASE_PROJECT_ID/);
  });

  it('defaults PORT to 8080 when omitted', () => {
    const { PORT: _, ...rest } = validRaw;
    expect(parseEnv(rest).PORT).toBe(8080);
  });
});

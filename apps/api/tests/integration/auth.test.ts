import type { DecodedIdToken } from 'firebase-admin/auth';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { upsertOnLoginMock } = vi.hoisted(() => ({
  upsertOnLoginMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/repositories/userRepository.js', () => ({
  upsertOnLogin: upsertOnLoginMock,
  getUserById: vi.fn(),
}));

import { createApp } from '../../src/app.js';
import {
  _resetFirebaseAuthForTests,
  _setVerifyIdTokenForTests,
  mapDecodedTokenToAuthUser,
} from '../../src/lib/firebaseAuth.js';

const VALID_TOKEN = 'valid-firebase-id-token';
const EXPIRED_TOKEN = 'expired-firebase-id-token';

function mockDecoded(overrides: Partial<DecodedIdToken> = {}): DecodedIdToken {
  return {
    uid: 'user-abc',
    email: 'user@example.com',
    name: 'Test User',
    picture: 'https://example.com/avatar.png',
    aud: 'geopulse-test',
    auth_time: 1,
    exp: 9_999_999_999,
    firebase: {
      identities: {},
      sign_in_provider: 'password',
    },
    iat: 1,
    iss: 'https://securetoken.google.com/geopulse-test',
    sub: 'user-abc',
    ...overrides,
  } as DecodedIdToken;
}

describe('Firebase Auth', () => {
  const app = createApp();

  beforeEach(() => {
    upsertOnLoginMock.mockClear();
    _setVerifyIdTokenForTests(async (token) => {
      if (token === VALID_TOKEN) {
        return mockDecoded();
      }
      if (token === EXPIRED_TOKEN) {
        throw new Error('Firebase ID token has expired');
      }
      throw new Error('Decoding Firebase ID token failed');
    });
  });

  afterEach(() => {
    _resetFirebaseAuthForTests();
  });

  it('returns 401 UNAUTHENTICATED when Authorization is missing', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    expect(upsertOnLoginMock).not.toHaveBeenCalled();
  });

  it('returns 401 when Bearer token is malformed', async () => {
    const res = await request(app)
      .get('/api/me')
      .set('Authorization', 'NotBearer abc');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 401 when token is expired/invalid', async () => {
    const res = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${EXPIRED_TOKEN}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    expect(upsertOnLoginMock).not.toHaveBeenCalled();
  });

  it('returns AuthUser for a valid mocked token and upserts users/{uid}', async () => {
    const res = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${VALID_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data).toEqual({
      uid: 'user-abc',
      email: 'user@example.com',
      name: 'Test User',
      picture: 'https://example.com/avatar.png',
    });
    expect(upsertOnLoginMock).toHaveBeenCalledTimes(1);
    expect(upsertOnLoginMock).toHaveBeenCalledWith(res.body.data);
  });

  it('maps DecodedIdToken claims to AuthUser', () => {
    expect(mapDecodedTokenToAuthUser(mockDecoded({ email: undefined, name: undefined }))).toEqual({
      uid: 'user-abc',
      email: null,
      name: null,
      picture: 'https://example.com/avatar.png',
    });
  });
});

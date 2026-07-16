import { describe, expect, it } from 'vitest';

import { hashKey } from '../../src/lib/hash.js';

describe('hashKey', () => {
  it('returns stable SHA-256 hex for a logical key', () => {
    const a = hashKey('market:usd:20');
    const b = hashKey('market:usd:20');
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(hashKey('other')).not.toBe(a);
  });
});

import { describe, expect, it } from 'vitest';

import { cacheStatusFromSource } from '../../src/lib/cacheStatus.js';

describe('cacheStatusFromSource', () => {
  it('maps cache sources to request_log statuses', () => {
    expect(cacheStatusFromSource('cache-l1')).toBe('hit-l1');
    expect(cacheStatusFromSource('cache-l2')).toBe('hit-l2');
    expect(cacheStatusFromSource('live')).toBe('miss');
    expect(cacheStatusFromSource('fallback')).toBe('n/a');
  });
});

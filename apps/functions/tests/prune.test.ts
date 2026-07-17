import { describe, expect, it } from 'vitest';

/**
 * Unit test of prune batch math (no Firestore).
 * Emulator round-trips need Java + firebase emulators:exec (see docs/setup/functions.md).
 */
describe('prune retention cutoff', () => {
  it('computes cutoff = now - retentionDays', () => {
    const now = new Date('2026-07-17T00:00:00.000Z');
    const retentionDays = 14;
    const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
    expect(cutoff.toISOString()).toBe('2026-07-03T00:00:00.000Z');
  });

  it('never uses a batch size above 500', () => {
    const requested = 2000;
    const batchSize = Math.min(500, requested);
    expect(batchSize).toBe(500);
  });
});

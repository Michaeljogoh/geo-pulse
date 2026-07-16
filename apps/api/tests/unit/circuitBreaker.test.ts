import { describe, expect, it } from 'vitest';

import { CircuitBreaker } from '../../src/lib/circuitBreaker.js';
import { AppError } from '../../src/lib/errors.js';

describe('CircuitBreaker', () => {
  it('transitions closed → open after failureThreshold consecutive failures', async () => {
    const cb = new CircuitBreaker('prov', {
      failureThreshold: 3,
      openMs: 1_000,
      halfOpenMaxCalls: 1,
    });

    for (let i = 0; i < 3; i += 1) {
      await expect(
        cb.exec(async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
    }

    expect(cb.getSnapshot().state).toBe('open');
    await expect(cb.exec(async () => 'ok')).rejects.toBeInstanceOf(AppError);
    await expect(cb.exec(async () => 'ok')).rejects.toMatchObject({ code: 'CIRCUIT_OPEN' });
  });

  it('rejects fast while open before openMs elapses', async () => {
    let now = 0;
    const cb = new CircuitBreaker('prov', {
      failureThreshold: 1,
      openMs: 5_000,
      halfOpenMaxCalls: 1,
      now: () => now,
    });

    await expect(
      cb.exec(async () => {
        throw new Error('fail');
      }),
    ).rejects.toThrow('fail');

    expect(cb.getSnapshot().state).toBe('open');
    now = 100;
    await expect(cb.exec(async () => 'ok')).rejects.toMatchObject({ code: 'CIRCUIT_OPEN' });
  });

  it('open → half_open after openMs, then half_open → closed on success', async () => {
    let now = 0;
    const cb = new CircuitBreaker('prov', {
      failureThreshold: 1,
      openMs: 1_000,
      halfOpenMaxCalls: 1,
      now: () => now,
    });

    await expect(
      cb.exec(async () => {
        throw new Error('fail');
      }),
    ).rejects.toThrow('fail');

    now = 1_000;
    expect(cb.getSnapshot().state).toBe('half_open');

    const result = await cb.exec(async () => 'recovered');
    expect(result).toBe('recovered');
    expect(cb.getSnapshot().state).toBe('closed');
  });

  it('half_open → open on trial failure', async () => {
    let now = 0;
    const cb = new CircuitBreaker('prov', {
      failureThreshold: 1,
      openMs: 500,
      halfOpenMaxCalls: 1,
      now: () => now,
    });

    await expect(
      cb.exec(async () => {
        throw new Error('fail');
      }),
    ).rejects.toThrow('fail');

    now = 500;
    expect(cb.getSnapshot().state).toBe('half_open');

    await expect(
      cb.exec(async () => {
        throw new Error('still broken');
      }),
    ).rejects.toThrow('still broken');

    expect(cb.getSnapshot().state).toBe('open');
  });
});

import type { Request } from 'express';
import { describe, expect, it } from 'vitest';

import { DEMO_PUBLIC_IP } from '../../src/config/constants.js';
import {
  isPrivateOrLoopbackIp,
  resolveClientIp,
  resolveLookupIp,
} from '../../src/lib/clientIp.js';

function mockReq(partial: {
  xff?: string;
  remoteAddress?: string;
}): Request {
  return {
    headers: partial.xff ? { 'x-forwarded-for': partial.xff } : {},
    socket: { remoteAddress: partial.remoteAddress },
  } as unknown as Request;
}

describe('clientIp helpers (Section 9.2)', () => {
  it('detects private and loopback addresses', () => {
    expect(isPrivateOrLoopbackIp('127.0.0.1')).toBe(true);
    expect(isPrivateOrLoopbackIp('::1')).toBe(true);
    expect(isPrivateOrLoopbackIp('10.0.0.1')).toBe(true);
    expect(isPrivateOrLoopbackIp('192.168.1.1')).toBe(true);
    expect(isPrivateOrLoopbackIp('8.8.8.8')).toBe(false);
  });

  it('prefers first X-Forwarded-For hop', () => {
    const ip = resolveClientIp(mockReq({ xff: '203.0.113.10, 10.0.0.1' }));
    expect(ip).toBe('203.0.113.10');
  });

  it('substitutes demo IP for private caller addresses', () => {
    const result = resolveLookupIp(mockReq({ remoteAddress: '127.0.0.1' }));
    expect(result).toEqual({ ip: DEMO_PUBLIC_IP, usedDemo: true });
  });

  it('uses explicit query ip without demo substitution', () => {
    const result = resolveLookupIp(mockReq({ remoteAddress: '127.0.0.1' }), '1.1.1.1');
    expect(result).toEqual({ ip: '1.1.1.1', usedDemo: false });
  });
});

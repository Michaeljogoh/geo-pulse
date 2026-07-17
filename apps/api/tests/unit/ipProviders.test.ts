import { describe, expect, it } from 'vitest';

import {
  deriveConfidence,
  deriveNetworkType,
  formatAsn,
  parseAsn,
} from '../../src/lib/ipIntelligence.js';
import { mapIpApiResponse } from '../../src/providers/ip/ipApiProvider.js';
import { mapIpWhoResponse } from '../../src/providers/ip/ipWhoProvider.js';
import { ipApiSuccess, ipWhoSuccess } from '../msw/handlers.js';

describe('ipIntelligence helpers', () => {
  it('derives networkType deterministically', () => {
    expect(
      deriveNetworkType({ isMobile: true, isHosting: false, isProxy: false }),
    ).toBe('mobile');
    expect(
      deriveNetworkType({ isMobile: false, isHosting: true, isProxy: false }),
    ).toBe('datacenter');
    expect(
      deriveNetworkType({ isMobile: false, isHosting: false, isProxy: true }),
    ).toBe('proxy_vpn');
    expect(
      deriveNetworkType({ isMobile: false, isHosting: false, isProxy: false }),
    ).toBe('residential');
    expect(
      deriveNetworkType({ isMobile: null, isHosting: null, isProxy: null }),
    ).toBe('unknown');
  });

  it('derives confidence', () => {
    expect(
      deriveConfidence({
        country: 'US',
        city: 'X',
        asn: 'AS1',
        isProxy: false,
        isHosting: true,
        isMobile: false,
      }),
    ).toBe(1);
    expect(
      deriveConfidence({
        country: null,
        city: null,
        asn: null,
        isProxy: null,
        isHosting: null,
        isMobile: null,
      }),
    ).toBe(0.5);
  });

  it('parses ASN tokens', () => {
    expect(parseAsn('AS15169 Google LLC')).toBe('AS15169');
    expect(formatAsn(15169)).toBe('AS15169');
  });
});

describe('IP provider mappers', () => {
  it('maps ip-api success payload', () => {
    const mapped = mapIpApiResponse(ipApiSuccess);
    expect(mapped.ip).toBe('8.8.8.8');
    expect(mapped.networkType).toBe('datacenter');
    expect(mapped.asn).toBe('AS15169');
    expect(mapped.currency).toBe('USD');
    expect(mapped.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('maps ipwho success payload with null flags', () => {
    const mapped = mapIpWhoResponse(ipWhoSuccess);
    expect(mapped.networkType).toBe('unknown');
    expect(mapped.isProxy).toBeNull();
    expect(mapped.asn).toBe('AS15169');
    expect(mapped.confidence).toBeCloseTo(0.9);
  });
});

import type { NetworkType } from '../types/domain.js';

/** Section 12.4 — deterministic networkType derivation. */
export function deriveNetworkType(flags: {
  isMobile: boolean | null;
  isHosting: boolean | null;
  isProxy: boolean | null;
}): NetworkType {
  const { isMobile, isHosting, isProxy } = flags;
  if (isMobile === true) return 'mobile';
  if (isHosting === true) return 'datacenter';
  if (isProxy === true) return 'proxy_vpn';
  if (isProxy === false && isHosting === false && isMobile === false) {
    return 'residential';
  }
  return 'unknown';
}

/** Section 12.4 — confidence in [0, 1]. */
export function deriveConfidence(input: {
  country: string | null;
  city: string | null;
  asn: string | null;
  isProxy: boolean | null;
  isHosting: boolean | null;
  isMobile: boolean | null;
}): number {
  let score = 0.5;
  if (input.country && input.city) score += 0.2;
  if (input.asn) score += 0.2;
  if (
    input.isProxy !== null &&
    input.isHosting !== null &&
    input.isMobile !== null
  ) {
    score += 0.1;
  }
  // Round to avoid IEEE float noise (e.g. 0.5+0.2+0.2+0.1).
  return Math.min(1, Math.max(0, Math.round(score * 100) / 100));
}

/** Extract leading `AS####` token from ip-api `as` field. */
export function parseAsn(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = raw.trim().match(/^(AS\d+)/i);
  return match?.[1]?.toUpperCase() ?? null;
}

export function formatAsn(asn: number | string | null | undefined): string | null {
  if (asn === null || asn === undefined || asn === '') return null;
  const s = String(asn).trim();
  if (!s) return null;
  if (/^AS\d+$/i.test(s)) return s.toUpperCase();
  if (/^\d+$/.test(s)) return `AS${s}`;
  return s;
}

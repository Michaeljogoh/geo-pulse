import { z } from 'zod';

import { HTTP_TIMEOUT_MS } from '../../config/constants.js';
import { AppError } from '../../lib/errors.js';
import { createHttpClient } from '../../lib/httpClient.js';
import {
  deriveConfidence,
  deriveNetworkType,
  formatAsn,
} from '../../lib/ipIntelligence.js';
import type { IpIntelligence } from '../../types/domain.js';
import type { IpIntelligenceProvider } from '../types.js';

const ipWhoSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  ip: z.string().optional(),
  country: z.string().nullable().optional(),
  country_code: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  timezone: z
    .object({
      id: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  currency: z
    .object({
      code: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  connection: z
    .object({
      isp: z.string().nullable().optional(),
      org: z.string().nullable().optional(),
      asn: z.union([z.number(), z.string()]).nullable().optional(),
    })
    .nullable()
    .optional(),
});

export function mapIpWhoResponse(raw: unknown): IpIntelligence {
  // Section 12.2 — nested fields; isProxy/isHosting/isMobile always null; asnName ← connection.isp
  const parsed = ipWhoSchema.safeParse(raw);
  if (!parsed.success) {
    throw AppError.upstreamError('Invalid ipwho.is response shape', parsed.error.issues);
  }
  const data = parsed.data;
  if (data.success === false) {
    // Section 13 — do not echo raw upstream bodies to clients (details stay server-side).
    throw AppError.upstreamError('ipwho.is lookup failed', {
      reason: data.message ?? 'success_false',
    });
  }

  const isProxy = null;
  const isHosting = null;
  const isMobile = null;
  const country = data.country ?? null;
  const city = data.city ?? null;
  const asn = formatAsn(data.connection?.asn ?? null);
  const isp = data.connection?.isp ?? null;

  return {
    ip: data.ip ?? '',
    country,
    countryCode: data.country_code ?? null,
    city,
    region: data.region ?? null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    timezone: data.timezone?.id ?? null,
    currency: data.currency?.code ? data.currency.code.toUpperCase() : null,
    isp,
    organization: data.connection?.org ?? null,
    asn,
    asnName: isp,
    isProxy,
    isHosting,
    isMobile,
    networkType: deriveNetworkType({ isMobile, isHosting, isProxy }),
    confidence: deriveConfidence({
      country,
      city,
      asn,
      isProxy,
      isHosting,
      isMobile,
    }),
  };
}

/** Phase 7 — ipwho.is fallback provider. */
export class IpWhoProvider implements IpIntelligenceProvider {
  readonly name = 'ipwho';
  private readonly client = createHttpClient({ name: this.name, timeoutMs: HTTP_TIMEOUT_MS });

  async lookup(ip: string): Promise<IpIntelligence> {
    const url = `https://ipwho.is/${encodeURIComponent(ip)}`;
    const res = await this.client.get<unknown>(url);
    return mapIpWhoResponse(res.data);
  }
}

import { z } from 'zod';

import { HTTP_TIMEOUT_MS } from '../../config/constants.js';
import { AppError } from '../../lib/errors.js';
import { createHttpClient } from '../../lib/httpClient.js';
import {
  deriveConfidence,
  deriveNetworkType,
  parseAsn,
} from '../../lib/ipIntelligence.js';
import type { IpIntelligence } from '../../types/domain.js';
import type { IpIntelligenceProvider } from '../types.js';

const FIELDS =
  'status,message,country,countryCode,region,regionName,city,lat,lon,timezone,currency,isp,org,as,asname,mobile,proxy,hosting,query';

const ipApiSchema = z.object({
  status: z.enum(['success', 'fail']),
  message: z.string().optional(),
  query: z.string().optional(),
  country: z.string().nullable().optional(),
  countryCode: z.string().nullable().optional(),
  regionName: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lon: z.number().nullable().optional(),
  timezone: z.string().nullable().optional(),
  currency: z.string().nullable().optional(),
  isp: z.string().nullable().optional(),
  org: z.string().nullable().optional(),
  as: z.string().nullable().optional(),
  asname: z.string().nullable().optional(),
  mobile: z.boolean().nullable().optional(),
  proxy: z.boolean().nullable().optional(),
  hosting: z.boolean().nullable().optional(),
});

export function mapIpApiResponse(raw: unknown): IpIntelligence {
  // Section 12.1 — only listed fields; missing → null; status !== success → UPSTREAM_ERROR
  const parsed = ipApiSchema.safeParse(raw);
  if (!parsed.success) {
    throw AppError.upstreamError('Invalid ip-api response shape', parsed.error.issues);
  }
  const data = parsed.data;
  if (data.status !== 'success') {
    // Section 13 — do not echo raw upstream bodies to clients (details stay server-side).
    throw AppError.upstreamError('ip-api lookup failed', {
      reason: data.message ?? 'status_fail',
    });
  }

  const isMobile = data.mobile ?? null;
  const isHosting = data.hosting ?? null;
  const isProxy = data.proxy ?? null;
  const country = data.country ?? null;
  const city = data.city ?? null;
  const asn = parseAsn(data.as ?? null);

  return {
    ip: data.query ?? '',
    country,
    countryCode: data.countryCode ?? null,
    city,
    region: data.regionName ?? null,
    latitude: data.lat ?? null,
    longitude: data.lon ?? null,
    timezone: data.timezone ?? null,
    currency: data.currency ? data.currency.toUpperCase() : null,
    isp: data.isp ?? null,
    organization: data.org ?? null,
    asn,
    asnName: data.asname ?? null,
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

/** Phase 7 — ip-api.com provider. */
export class IpApiProvider implements IpIntelligenceProvider {
  readonly name = 'ipapi';
  private readonly client = createHttpClient({ name: this.name, timeoutMs: HTTP_TIMEOUT_MS });

  async lookup(ip: string): Promise<IpIntelligence> {
    const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=${FIELDS}`;
    const res = await this.client.get<unknown>(url);
    return mapIpApiResponse(res.data);
  }
}

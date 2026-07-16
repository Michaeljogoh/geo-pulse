import type { ApiError, ApiResponse, ResponseMeta } from '../types/envelope.js';

type MetaPartial = Partial<Omit<ResponseMeta, 'requestId' | 'latencyMs'>> & {
  requestId: string;
  startTime: number;
};

function buildMeta(partial: MetaPartial): ResponseMeta {
  const { startTime, ...rest } = partial;
  return {
    source: rest.source ?? 'live',
    latencyMs: Math.max(0, Date.now() - startTime),
    cached: rest.cached ?? false,
    requestId: rest.requestId,
    ...(rest.provider !== undefined ? { provider: rest.provider } : {}),
    ...(rest.confidence !== undefined ? { confidence: rest.confidence } : {}),
    ...(rest.lastUpdated !== undefined ? { lastUpdated: rest.lastUpdated } : {}),
    ...(rest.degraded !== undefined ? { degraded: rest.degraded } : {}),
  };
}

export function ok<T>(data: T, metaPartial: MetaPartial): ApiResponse<T> {
  return {
    data,
    meta: buildMeta(metaPartial),
    error: null,
  };
}

export function fail(error: ApiError, metaPartial: MetaPartial): ApiResponse<null> {
  return {
    data: null,
    meta: buildMeta({ ...metaPartial, source: metaPartial.source ?? 'live' }),
    error,
  };
}

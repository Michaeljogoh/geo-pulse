import { z } from 'zod';

import { MARKET_DEFAULT_LIMIT, MARKET_MAX_LIMIT } from '../config/constants.js';

export const ipQuerySchema = z.object({
  ip: z.string().ip().optional(),
});

export const vsCurrencySchema = z
  .string()
  .regex(/^[a-zA-Z]{3,5}$/, 'must be a 3–5 letter currency code')
  .transform((s) => s.toLowerCase())
  .default('usd');

export const marketQuerySchema = z.object({
  vs: vsCurrencySchema,
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MARKET_MAX_LIMIT)
    .default(MARKET_DEFAULT_LIMIT),
});

export const trendingQuerySchema = z.object({
  vs: vsCurrencySchema,
});

export const newsQuerySchema = z.object({
  country: z
    .string()
    .regex(/^[a-zA-Z]{2}$/, 'must be an ISO 3166-1 alpha-2 country code')
    .transform((s) => s.toUpperCase())
    .optional(),
  symbols: z
    .string()
    .optional()
    .transform((raw) => {
      if (!raw || raw.trim() === '') return undefined;
      return raw
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
    }),
  lang: z.string().min(2).max(8).default('en'),
});

export const watchlistQuerySchema = z.object({
  vs: vsCurrencySchema,
});

export const coinIdParamSchema = z.object({
  coinId: z
    .string()
    .regex(/^[a-z0-9-]{1,64}$/, 'must be a CoinGecko coin id (lowercase letters, digits, hyphens)'),
});

export type IpQuery = z.infer<typeof ipQuerySchema>;
export type MarketQuery = z.infer<typeof marketQuerySchema>;
export type TrendingQuery = z.infer<typeof trendingQuerySchema>;
export type NewsQuery = z.infer<typeof newsQuerySchema>;
export type WatchlistQuery = z.infer<typeof watchlistQuerySchema>;
export type CoinIdParams = z.infer<typeof coinIdParamSchema>;

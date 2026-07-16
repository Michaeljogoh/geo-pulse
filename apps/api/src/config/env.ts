import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

if (process.env.NODE_ENV !== 'test') {
  loadDotenv();
}

const booleanFromString = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .min(1)
    .transform((s) =>
      s
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().url()).min(1)),
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().email(),
  FIREBASE_PRIVATE_KEY: z.string().min(1).transform((k) => k.replace(/\\n/g, '\n')),
  IP_PROVIDER: z.enum(['ipapi', 'ipwho', 'ipmeta']).default('ipapi'),
  COINGECKO_BASE_URL: z.string().url().default('https://api.coingecko.com/api/v3'),
  COINGECKO_DEMO_KEY: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : v),
    z.string().min(1).optional(),
  ),
  CRYPTOPANIC_TOKEN: z.string().min(1),
  GNEWS_API_KEY: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : v),
    z.string().min(1).optional(),
  ),
  CACHE_ENABLED: booleanFromString.default(true),
  AUTH_ENABLED: booleanFromString.default(true),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${formatted}`);
  }
  return Object.freeze(result.data);
}

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  try {
    return parseEnv(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console -- boot-time failure before logger may exist
    console.error(message);
    process.exit(1);
  }
}

export const env: Env = loadEnv();

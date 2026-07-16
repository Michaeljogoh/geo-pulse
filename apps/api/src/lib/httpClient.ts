import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import axios from 'axios';

import {
  HTTP_BACKOFF_BASE_MS,
  HTTP_BACKOFF_FACTOR,
  HTTP_BACKOFF_JITTER_MS,
  HTTP_MAX_RETRIES,
  HTTP_TIMEOUT_MS,
} from '../config/constants.js';
import { logger } from './logger.js';

export interface HttpClientOptions {
  timeoutMs?: number;
  name: string;
}

export interface NormalizedHttpError {
  isTimeout: boolean;
  status: number | null;
  providerName: string;
  message: string;
}

interface RetryConfig extends InternalAxiosRequestConfig {
  __retryCount?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeDelay(attempt: number, retryAfterHeader?: string): number {
  if (retryAfterHeader) {
    const asSeconds = Number(retryAfterHeader);
    if (!Number.isNaN(asSeconds) && asSeconds >= 0) {
      return asSeconds * 1000;
    }
    const asDate = Date.parse(retryAfterHeader);
    if (!Number.isNaN(asDate)) {
      return Math.max(0, asDate - Date.now());
    }
  }
  const exp = Math.min(HTTP_BACKOFF_BASE_MS * HTTP_BACKOFF_FACTOR ** attempt, 5000);
  const jitter = Math.floor(Math.random() * (HTTP_BACKOFF_JITTER_MS + 1));
  return exp + jitter;
}

function isRetryable(error: AxiosError): boolean {
  if (!error.response) {
    return (
      error.code === 'ECONNABORTED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNRESET' ||
      error.code === 'ENOTFOUND' ||
      error.message === 'Network Error'
    );
  }
  const status = error.response.status;
  return status === 429 || status >= 500;
}

function toNormalizedError(error: AxiosError, providerName: string): NormalizedHttpError {
  const isTimeout =
    error.code === 'ECONNABORTED' ||
    error.code === 'ETIMEDOUT' ||
    /timeout/i.test(error.message);
  return {
    isTimeout,
    status: error.response?.status ?? null,
    providerName,
    message: error.message,
  };
}

export function createHttpClient(options: HttpClientOptions): AxiosInstance {
  const { name, timeoutMs = HTTP_TIMEOUT_MS } = options;

  const client = axios.create({
    timeout: timeoutMs,
    headers: { Accept: 'application/json' },
    validateStatus: (status) => status >= 200 && status < 300,
  });

  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config as RetryConfig | undefined;
      if (!config) {
        return Promise.reject(toNormalizedError(error, name));
      }

      const retryCount = config.__retryCount ?? 0;
      const requestId =
        typeof config.headers?.['x-request-id'] === 'string'
          ? config.headers['x-request-id']
          : undefined;

      if (retryCount < HTTP_MAX_RETRIES && isRetryable(error)) {
        config.__retryCount = retryCount + 1;
        const retryAfter = error.response?.headers?.['retry-after'] as string | undefined;
        const delayMs = computeDelay(retryCount, retryAfter);
        logger.debug(
          { provider: name, attempt: config.__retryCount, delayMs, requestId, status: error.response?.status },
          'http client retrying',
        );
        await sleep(delayMs);
        return client.request(config);
      }

      const normalized = toNormalizedError(error, name);
      logger.warn(
        {
          provider: name,
          requestId,
          isTimeout: normalized.isTimeout,
          status: normalized.status,
          attempts: retryCount + 1,
        },
        'http client final failure',
      );
      return Promise.reject(normalized);
    },
  );

  return client;
}

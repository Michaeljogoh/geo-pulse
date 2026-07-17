import axios from 'axios';

import { loadConfig, WARM_CACHE_PATHS } from './lib/config';

export interface WarmEndpointResult {
  path: string;
  ok: boolean;
  status?: number;
  error?: string;
}

/**
 * HTTP GET hot API endpoints so apps/api L2 Firestore cache stays warm.
 * Exported for unit tests (no Firebase schedule wrapper).
 */
export async function runWarmCache(
  apiBaseUrl = loadConfig().apiBaseUrl,
): Promise<WarmEndpointResult[]> {
  if (!apiBaseUrl) {
    throw new Error('API_BASE_URL is required for warmCache');
  }

  const results: WarmEndpointResult[] = [];

  for (const path of WARM_CACHE_PATHS) {
    const url = `${apiBaseUrl}${path}`;
    try {
      const res = await axios.get(url, {
        timeout: 30_000,
        validateStatus: () => true,
      });
      const ok = res.status >= 200 && res.status < 300;
      results.push({ path, ok, status: res.status });
      console.info(JSON.stringify({ msg: 'warmCache', path, status: res.status, ok }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ path, ok: false, error: message });
      console.warn(JSON.stringify({ msg: 'warmCache failed', path, error: message }));
    }
  }

  return results;
}

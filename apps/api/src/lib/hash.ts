import { createHash } from 'node:crypto';

/** Stable cache-key hashing: logical key → SHA-256 hex. */
export function hashKey(logicalKey: string): string {
  return createHash('sha256').update(logicalKey).digest('hex');
}

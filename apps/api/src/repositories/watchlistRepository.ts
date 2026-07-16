import { Timestamp } from 'firebase-admin/firestore';

import { WATCHLIST_MAX_ITEMS } from '../config/constants.js';
import { COLLECTIONS } from '../lib/collections.js';
import { AppError } from '../lib/errors.js';
import { getDb, initFirestore } from '../lib/firestore.js';
import type { WatchlistCoinEntry, WatchlistDocument } from '../types/firestore.js';

export interface WatchlistCoin {
  coinId: string;
  addedAt: string; // ISO 8601
}

function toCoins(doc: WatchlistDocument | undefined): WatchlistCoin[] {
  if (!doc?.coins) return [];
  return doc.coins.map((c) => ({
    coinId: c.coinId,
    addedAt: c.addedAt.toDate().toISOString(),
  }));
}

/** Read `watchlists/{uid}` (Section 10 / Phase 15). */
export async function getWatchlist(uid: string): Promise<WatchlistCoin[]> {
  initFirestore();
  const snap = await getDb().collection(COLLECTIONS.WATCHLISTS).doc(uid).get();
  if (!snap.exists) return [];
  return toCoins(snap.data() as WatchlistDocument);
}

/**
 * Add coin via transaction — unique coinIds, max WATCHLIST_MAX_ITEMS (Section 10).
 * Idempotent if coin already present.
 */
export async function addCoin(uid: string, coinId: string): Promise<WatchlistCoin[]> {
  initFirestore();
  const ref = getDb().collection(COLLECTIONS.WATCHLISTS).doc(uid);

  return getDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Timestamp.now();
    const existing = snap.exists
      ? ((snap.data() as WatchlistDocument).coins ?? [])
      : [];

    if (existing.some((c) => c.coinId === coinId)) {
      const doc: WatchlistDocument = {
        uid,
        coins: existing,
        updatedAt: now,
      };
      tx.set(ref, doc);
      return toCoins(doc);
    }

    if (existing.length >= WATCHLIST_MAX_ITEMS) {
      throw AppError.validation(
        { max: WATCHLIST_MAX_ITEMS },
        `Watchlist is capped at ${WATCHLIST_MAX_ITEMS} coins`,
      );
    }

    const coins: WatchlistCoinEntry[] = [...existing, { coinId, addedAt: now }];
    const doc: WatchlistDocument = {
      uid,
      coins,
      updatedAt: now,
    };
    tx.set(ref, doc);
    return toCoins(doc);
  });
}

/** Remove coin via transaction; returns updated list. */
export async function removeCoin(uid: string, coinId: string): Promise<WatchlistCoin[]> {
  initFirestore();
  const ref = getDb().collection(COLLECTIONS.WATCHLISTS).doc(uid);

  return getDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Timestamp.now();
    const existing = snap.exists
      ? ((snap.data() as WatchlistDocument).coins ?? [])
      : [];

    const coins = existing.filter((c) => c.coinId !== coinId);
    const doc: WatchlistDocument = {
      uid,
      coins,
      updatedAt: now,
    };
    tx.set(ref, doc);
    return toCoins(doc);
  });
}

/** @deprecated use getWatchlist */
export async function listWatchlist(uid: string): Promise<WatchlistCoin[]> {
  return getWatchlist(uid);
}

/** @deprecated use addCoin */
export async function addToWatchlist(uid: string, coinId: string): Promise<WatchlistCoin[]> {
  return addCoin(uid, coinId);
}

/** @deprecated use removeCoin */
export async function removeFromWatchlist(uid: string, coinId: string): Promise<void> {
  await removeCoin(uid, coinId);
}

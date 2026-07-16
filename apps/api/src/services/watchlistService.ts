import { AppError } from '../lib/errors.js';
import type { WatchlistItem } from '../types/domain.js';

/** Phase 15 — authenticated user watchlist service. */
export async function getWatchlist(_uid: string, _vs = 'usd'): Promise<WatchlistItem[]> {
  throw AppError.internal('Not implemented: watchlistService.getWatchlist (Phase 15)');
}

export async function addWatchlistItem(
  _uid: string,
  _coinId: string,
  _vs = 'usd',
): Promise<WatchlistItem[]> {
  throw AppError.internal('Not implemented: watchlistService.addWatchlistItem (Phase 15)');
}

export async function removeWatchlistItem(
  _uid: string,
  _coinId: string,
  _vs = 'usd',
): Promise<WatchlistItem[]> {
  throw AppError.internal('Not implemented: watchlistService.removeWatchlistItem (Phase 15)');
}

/** Phase 15 — authenticated user watchlist service. */
export async function getWatchlist(_uid: string): Promise<unknown> {
  throw new Error('Not implemented: watchlistService.getWatchlist (Phase 15)');
}

export async function addWatchlistItem(_uid: string, _coinId: string): Promise<unknown> {
  throw new Error('Not implemented: watchlistService.addWatchlistItem (Phase 15)');
}

export async function removeWatchlistItem(_uid: string, _coinId: string): Promise<void> {
  throw new Error('Not implemented: watchlistService.removeWatchlistItem (Phase 15)');
}

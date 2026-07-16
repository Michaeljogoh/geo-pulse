/** Phase 15 — watchlist persistence. */
export async function listWatchlist(_uid: string): Promise<unknown[]> {
  throw new Error('Not implemented: watchlistRepository.list (Phase 15)');
}

export async function addToWatchlist(_uid: string, _coinId: string): Promise<unknown> {
  throw new Error('Not implemented: watchlistRepository.add (Phase 15)');
}

export async function removeFromWatchlist(_uid: string, _coinId: string): Promise<void> {
  throw new Error('Not implemented: watchlistRepository.remove (Phase 15)');
}

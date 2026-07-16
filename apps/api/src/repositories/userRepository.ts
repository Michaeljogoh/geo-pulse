/** Phase 14 — user profile persistence (Firebase Auth uid). */
export async function getUserById(_uid: string): Promise<unknown | null> {
  throw new Error('Not implemented: userRepository.getUserById (Phase 14)');
}

export async function upsertUser(_uid: string, _data: Record<string, unknown>): Promise<unknown> {
  throw new Error('Not implemented: userRepository.upsertUser (Phase 14)');
}

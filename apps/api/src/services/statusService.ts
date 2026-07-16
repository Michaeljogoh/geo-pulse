/** Phase 11 — provider health + cache stats + uptime. */
export async function getStatus(): Promise<{
  providers: unknown[];
  cache: { l1Keys: number; hitRatio: number };
  uptimeSeconds: number;
}> {
  throw new Error('Not implemented: statusService.getStatus (Phase 11)');
}

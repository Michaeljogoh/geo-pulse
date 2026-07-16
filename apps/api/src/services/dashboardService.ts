import type { DashboardPayload } from '../types/domain.js';

/** Phase 10 — dashboard aggregation (geo → parallel market/trending/news). */
export async function getDashboard(_ip: string): Promise<DashboardPayload> {
  throw new Error('Not implemented: dashboardService.getDashboard (Phase 10)');
}

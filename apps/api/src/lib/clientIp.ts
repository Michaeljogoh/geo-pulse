import type { Request } from 'express';
import { isIP } from 'node:net';

import { DEMO_PUBLIC_IP } from '../config/constants.js';

export function isPrivateOrLoopbackIp(ip: string): boolean {
  const normalized = stripIpv4Mapped(ip).toLowerCase();

  if (normalized === '::1' || normalized === '127.0.0.1' || normalized === 'localhost') {
    return true;
  }
  if (normalized.startsWith('10.')) return true;
  if (normalized.startsWith('192.168.')) return true;
  if (normalized.startsWith('169.254.')) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)) return true;
  // Unique-local / link-local IPv6
  if (normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:')) {
    return true;
  }
  return false;
}

export function resolveClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim().length > 0) {
    const first = xff.split(',')[0]?.trim();
    if (first) return stripIpv4Mapped(first);
  }
  if (Array.isArray(xff) && xff[0]) {
    const first = xff[0].split(',')[0]?.trim();
    if (first) return stripIpv4Mapped(first);
  }
  const remote = req.socket.remoteAddress;
  if (remote) return stripIpv4Mapped(remote);
  return DEMO_PUBLIC_IP;
}

/**
 * Resolve the IP used for geo lookup (Section 9.2 / 9.6).
 * Private/loopback caller IPs are substituted with DEMO_PUBLIC_IP (never an error).
 */
export function resolveLookupIp(
  req: Request,
  queryIp?: string,
): { ip: string; usedDemo: boolean } {
  if (queryIp) {
    return { ip: stripIpv4Mapped(queryIp), usedDemo: false };
  }
  const clientIp = resolveClientIp(req);
  if (!isIP(clientIp) || isPrivateOrLoopbackIp(clientIp)) {
    return { ip: DEMO_PUBLIC_IP, usedDemo: true };
  }
  return { ip: clientIp, usedDemo: false };
}

function stripIpv4Mapped(ip: string): string {
  return ip.replace(/^::ffff:/i, '');
}

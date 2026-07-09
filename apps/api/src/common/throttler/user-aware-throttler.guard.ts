import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Default ThrottlerGuard tracks callers by IP alone. That collapses every
 * authenticated user sitting behind the same NAT/VPN/corporate proxy — a
 * routine setup for an ERP customer — into a single shared rate-limit
 * bucket, so one office of legitimate users throttles itself out.
 *
 * Found live via the Day 21 k6 load test: 2,000 VUs from one source IP hit
 * ~90% failure not because the API/DB couldn't keep up (it could — p95 was
 * under 20ms) but because they all shared one 5-req/s bucket.
 *
 * This guard keys by the JWT `sub` claim when a Bearer token is present, so
 * distinct authenticated users get distinct buckets even from the same IP.
 * The token is only base64-decoded here, not signature-verified — that's
 * fine for a rate-limit *key* (worst case with a forged token is the caller
 * gets their own bucket instead of sharing one; actual authn/authz still
 * happens downstream in the route's real auth guard). Requests with no
 * bearer token (e.g. POST /tenant) fall back to IP, unchanged from before.
 */
@Injectable()
export class UserAwareThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const authHeader: string | undefined = req.headers?.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    if (token) {
      const sub = this.decodeSubClaim(token);
      if (sub) return `user:${sub}`;
    }

    return req.ips?.length ? req.ips[0] : req.ip;
  }

  private decodeSubClaim(token: string): string | null {
    try {
      const payloadB64 = token.split('.')[1];
      if (!payloadB64) return null;
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));
      return typeof payload.sub === 'string' ? payload.sub : null;
    } catch {
      return null;
    }
  }
}

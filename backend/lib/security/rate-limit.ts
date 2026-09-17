import { type NextRequest } from "next/server";

export type RateLimitCategory = "AUTH" | "PAYMENT" | "WRITE" | "READ";

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

/**
 * Reasonable rate limit configurations tailored for the RentSafe platform.
 * Balanced to prevent abuse without impeding normal student/owner workflows.
 */
export const RATE_LIMIT_CONFIGS: Record<RateLimitCategory, RateLimitConfig> = {
  AUTH: {
    limit: 10,
    windowMs: 60 * 1000, // 10 requests per minute
  },
  PAYMENT: {
    limit: 10,
    windowMs: 60 * 1000, // 10 requests per minute
  },
  WRITE: {
    limit: 40,
    windowMs: 60 * 1000, // 40 mutations per minute
  },
  READ: {
    limit: 120,
    windowMs: 60 * 1000, // 120 queries per minute
  },
};

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

/**
 * ============================================================================
 * ARCHITECTURAL NOTICE:
 * This in-memory rate limiter provides zero-dependency protection for single-instance
 * deployments, local development, and evaluation environments.
 * 
 * In a distributed, multi-instance production cluster (e.g. multiple container pods,
 * Vercel multi-region serverless nodes), an external distributed key-value store
 * such as Redis or Upstash is required to synchronize rate limit counts across instances.
 * ============================================================================
 */
class InMemoryRateLimiter {
  private store = new Map<string, RateLimitRecord>();
  private lastCleanup = Date.now();

  private cleanup(): void {
    const now = Date.now();
    // Run cleanup every 60 seconds
    if (now - this.lastCleanup < 60 * 1000) return;

    this.lastCleanup = now;
    for (const [key, record] of this.store.entries()) {
      if (now > record.resetTime) {
        this.store.delete(key);
      }
    }
  }

  public check(
    identifier: string,
    category: RateLimitCategory
  ): {
    success: boolean;
    limit: number;
    remaining: number;
    resetTime: number;
    retryAfter: number;
  } {
    this.cleanup();

    const config = RATE_LIMIT_CONFIGS[category];
    const key = `${category}:${identifier}`;
    const now = Date.now();

    const existing = this.store.get(key);

    if (!existing || now > existing.resetTime) {
      // First request in a new window
      const record: RateLimitRecord = {
        count: 1,
        resetTime: now + config.windowMs,
      };
      this.store.set(key, record);

      return {
        success: true,
        limit: config.limit,
        remaining: config.limit - 1,
        resetTime: record.resetTime,
        retryAfter: 0,
      };
    }

    // Existing window
    if (existing.count >= config.limit) {
      const retryAfter = Math.max(1, Math.ceil((existing.resetTime - now) / 1000));
      return {
        success: false,
        limit: config.limit,
        remaining: 0,
        resetTime: existing.resetTime,
        retryAfter,
      };
    }

    existing.count += 1;
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - existing.count,
      resetTime: existing.resetTime,
      retryAfter: 0,
    };
  }
}

export const rateLimiter = new InMemoryRateLimiter();

/**
 * Extracts client IP address safely from request headers.
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "127.0.0.1";
}

/**
 * Determines the rate limiting category based on endpoint path and HTTP method.
 */
export function getRateLimitCategory(
  pathname: string,
  method: string
): RateLimitCategory | null {
  // Only rate-limit API routes
  if (!pathname.startsWith("/api")) {
    return null;
  }

  // 1. Auth endpoints
  if (
    pathname.startsWith("/api/auth/signin") ||
    pathname.startsWith("/api/auth/signup")
  ) {
    return "AUTH";
  }

  // 2. Payment endpoints
  if (pathname.includes("/payment")) {
    return "PAYMENT";
  }

  // 3. Write mutations
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())) {
    return "WRITE";
  }

  // 4. Read queries
  if (method.toUpperCase() === "GET") {
    return "READ";
  }

  return null;
}

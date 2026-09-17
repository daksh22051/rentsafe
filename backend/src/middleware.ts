import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  rateLimiter,
  getClientIp,
  getRateLimitCategory,
} from "@/lib/security/rate-limit";
import { applySecurityHeaders } from "@/lib/security/headers";
import { handleCorsPreflight, applyCorsHeaders } from "@/lib/security/cors";
import { rateLimitResponse } from "@/lib/api-response";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Handle CORS Preflight for API routes
  if (pathname.startsWith("/api")) {
    const preflightResponse = handleCorsPreflight(request);
    if (preflightResponse) {
      return applySecurityHeaders(preflightResponse);
    }

    // 2. Centralized Rate Limiting for API routes
    const category = getRateLimitCategory(pathname, request.method);
    if (category) {
      const clientIp = getClientIp(request);
      const rateResult = rateLimiter.check(clientIp, category);

      if (!rateResult.success) {
        const rateLimitRes = rateLimitResponse(
          rateResult.retryAfter,
          "Too many requests. Please slow down and try again later."
        );
        applyCorsHeaders(rateLimitRes, request);
        return applySecurityHeaders(rateLimitRes);
      }
    }
  }

  // 3. Supabase Auth Session Refresh
  const response = await updateSession(request);

  // 4. Traceability: Attach unique request ID
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  response.headers.set("x-request-id", requestId);

  // 5. Apply CORS and Production Security Headers
  if (pathname.startsWith("/api")) {
    applyCorsHeaders(response, request);
  }
  applySecurityHeaders(response);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images, png, jpg, svg, etc.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

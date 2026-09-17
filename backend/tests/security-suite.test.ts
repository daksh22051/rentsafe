import {
  TestRunner,
  assert,
} from "./test-utils";
import {
  rateLimiter,
  getClientIp,
  getRateLimitCategory,
  RATE_LIMIT_CONFIGS,
} from "@/lib/security/rate-limit";
import {
  applySecurityHeaders,
} from "@/lib/security/headers";
import {
  isOriginAllowed,
  handleCorsPreflight,
} from "@/lib/security/cors";
import {
  handleApiError,
  AuthException,
  rateLimitResponse,
} from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { validateEnv } from "@/lib/env";
import { GET as healthCheckHandler } from "@/app/api/health/route";

export async function runSecuritySuite(runner: TestRunner): Promise<void> {
  await runner.suite("Production Security & Hardening Suite", async () => {
    // ----------------------------------------------------
    // 1. Rate Limiting Tests
    // ----------------------------------------------------
    await runner.test("Rate Limiting: Category detector routes requests appropriately", () => {
      assert(
        getRateLimitCategory("/api/auth/signin", "POST") === "AUTH",
        "Signin is AUTH category"
      );
      assert(
        getRateLimitCategory("/api/auth/signup", "POST") === "AUTH",
        "Signup is AUTH category"
      );
      assert(
        getRateLimitCategory("/api/bookings/xyz/payment", "POST") === "PAYMENT",
        "Payment is PAYMENT category"
      );
      assert(
        getRateLimitCategory("/api/properties", "POST") === "WRITE",
        "Property creation is WRITE category"
      );
      assert(
        getRateLimitCategory("/api/properties", "GET") === "READ",
        "Property discovery is READ category"
      );
      assert(
        getRateLimitCategory("/_next/static/chunk.js", "GET") === null,
        "Static files bypass rate limiting"
      );
    });

    await runner.test("Rate Limiting: Strict AUTH rate limit triggers HTTP 429 after 10 requests", () => {
      const testIp = "192.168.1.100";
      const config = RATE_LIMIT_CONFIGS.AUTH;
      assert(config.limit === 10, "AUTH limit must be 10 requests/min");

      // Send 10 requests (should succeed)
      for (let i = 1; i <= 10; i++) {
        const result = rateLimiter.check(testIp, "AUTH");
        assert(result.success === true, `Request ${i} should be allowed`);
        assert(result.remaining === 10 - i, `Remaining count should be ${10 - i}`);
      }

      // 11th request (should be blocked)
      const blocked = rateLimiter.check(testIp, "AUTH");
      assert(blocked.success === false, "11th request must be rejected");
      assert(blocked.remaining === 0, "Remaining count must be 0");
      assert(blocked.retryAfter > 0, "retryAfter seconds must be positive");
    });

    await runner.test("Rate Limiting: Exceeded response has Retry-After and RATE_LIMIT_EXCEEDED", async () => {
      const res = rateLimitResponse(45, "Rate limit exceeded for test");
      assert(res.status === 429, "Status must be 429");
      assert(res.headers.get("Retry-After") === "45", "Retry-After header must be 45");

      const body = await res.json();
      assert(body.success === false, "Success must be false");
      assert(body.error.code === "RATE_LIMIT_EXCEEDED", "Error code matches");
    });

    await runner.test("Rate Limiting: Client IP extraction handles proxy headers", () => {
      const req1 = new NextRequest("http://localhost:3000/api/properties", {
        headers: { "x-forwarded-for": "203.0.113.195, 70.41.3.18" },
      });
      assert(getClientIp(req1) === "203.0.113.195", "Extracts first forwarded IP");

      const req2 = new NextRequest("http://localhost:3000/api/properties", {
        headers: { "x-real-ip": "198.51.100.22" },
      });
      assert(getClientIp(req2) === "198.51.100.22", "Extracts real IP");
    });

    // ----------------------------------------------------
    // 2. Security Headers Tests
    // ----------------------------------------------------
    await runner.test("Security Headers: Baseline production headers are present", () => {
      const res = NextResponse.json({ ok: true });
      const secured = applySecurityHeaders(res);

      assert(
        secured.headers.get("X-Content-Type-Options") === "nosniff",
        "nosniff header present"
      );
      assert(
        secured.headers.get("X-Frame-Options") === "DENY",
        "X-Frame-Options DENY present"
      );
      assert(
        secured.headers.get("Referrer-Policy") === "strict-origin-when-cross-origin",
        "Referrer-Policy present"
      );
      assert(
        secured.headers.get("Strict-Transport-Security")?.includes("max-age=31536000") === true,
        "HSTS present"
      );
      assert(
        secured.headers.get("Permissions-Policy")?.includes("camera=()") === true,
        "Permissions-Policy present"
      );
    });

    // ----------------------------------------------------
    // 3. CORS Tests
    // ----------------------------------------------------
    await runner.test("CORS: Valid origins permitted, malicious origins rejected", () => {
      assert(isOriginAllowed("http://localhost:3000") === true, "localhost:3000 is allowed");
      assert(isOriginAllowed("http://127.0.0.1:3000") === true, "127.0.0.1:3000 is allowed");
      assert(isOriginAllowed("https://malicious-site.com") === false, "Malicious domain rejected");
      assert(isOriginAllowed(null) === false, "Null origin rejected");
    });

    await runner.test("CORS: OPTIONS preflight returns HTTP 204 with allowed methods", () => {
      const req = new NextRequest("http://localhost:3000/api/properties", {
        method: "OPTIONS",
        headers: { origin: "http://localhost:3000" },
      });
      const preflight = handleCorsPreflight(req);
      assert(preflight !== null, "Preflight handled");
      assert(preflight?.status === 204, "Preflight status is 204 No Content");
      assert(
        preflight?.headers.get("Access-Control-Allow-Origin") === "http://localhost:3000",
        "Origin set in preflight"
      );
      assert(
        preflight?.headers.get("Access-Control-Allow-Credentials") === "true",
        "Credentials allowed in preflight"
      );
    });

    // ----------------------------------------------------
    // 4. Error Response Hardening Tests
    // ----------------------------------------------------
    await runner.test("Error Hardening: AuthException preserves status code and message", async () => {
      const err = new AuthException(403, "FORBIDDEN", "You do not own this property");
      const res = handleApiError(err);
      assert(res.status === 403, "Status is 403");
      const body = await res.json();
      assert(body.error.code === "FORBIDDEN", "Code is FORBIDDEN");
      assert(body.error.message === "You do not own this property", "Message preserved");
    });

    await runner.test("Error Hardening: ZodError returns 400 with flattened field errors", async () => {
      let zodError: ZodError | null = null;
      try {
        const { z } = await import("zod");
        z.object({ requiredField: z.string() }).parse({});
      } catch (e) {
        if (e instanceof ZodError) zodError = e;
      }
      assert(zodError !== null, "Zod error caught");

      const res = handleApiError(zodError);
      assert(res.status === 400, "Status is 400");
      const body = await res.json();
      assert(body.error.code === "VALIDATION_ERROR", "Code is VALIDATION_ERROR");
      assert(body.error.details !== undefined, "Details contains field errors");
    });

    await runner.test("Error Hardening: Internal database error does NOT leak connection string or SQL", async () => {
      // Simulate raw database error containing sensitive DB string and SQL
      const sensitiveDbError = new Error(
        "FATAL: password authentication failed for user postgres at postgresql://postgres:SecretPassword123@db.supabase.com:5432/rentsafe. Error in query: SELECT * FROM users WHERE secret_token = 'xyz'"
      );

      const res = handleApiError(sensitiveDbError);
      assert(res.status === 500, "Status is 500");

      const body = await res.json();
      const bodyStr = JSON.stringify(body);

      // Verify ZERO sensitive tokens or DB strings in client response
      assert(!bodyStr.includes("SecretPassword123"), "Secret password NOT in response");
      assert(!bodyStr.includes("postgresql://"), "Database URL NOT in response");
      assert(!bodyStr.includes("SELECT * FROM"), "SQL statement NOT in response");
      assert(!bodyStr.includes("secret_token"), "Internal column names NOT in response");
      assert(
        body.error.message === "An unexpected server error occurred. Please try again later.",
        "Generic safe message returned to client"
      );
    });

    // ----------------------------------------------------
    // 5. Production Readiness & Health Check Tests
    // ----------------------------------------------------
    await runner.test("Production Readiness: validateEnv returns structured status", () => {
      const result = validateEnv();
      assert(typeof result.isValid === "boolean", "isValid is boolean");
      assert(Array.isArray(result.missingOrInvalid), "missingOrInvalid is array");
    });

    await runner.test("Health Endpoint: GET /api/health returns HTTP 200 with status ok", async () => {
      const response = await healthCheckHandler();
      assert(response.status === 200, "Health endpoint status must be 200");
      const body = await response.json();
      assert(body.success === true, "success is true");
      assert(body.data.status === "ok", "status is ok");
      assert(typeof body.data.database === "string", "database status is reported");
      assert(typeof body.data.uptimeSeconds === "number", "uptime is reported");
    });
  });
}

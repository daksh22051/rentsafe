import { NextRequest, NextResponse } from "next/server";

/**
 * Resolves allowed CORS origins from environment or safe local fallbacks.
 * Never uses wildcard `*` with credentials.
 */
export function getAllowedOrigins(): string[] {
  const envOrigins = process.env.ALLOWED_ORIGIN;
  if (envOrigins) {
    return envOrigins.split(",").map((o) => o.trim().toLowerCase());
  }

  // Safe defaults for local development
  return [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
  ];
}

/**
 * Checks whether an incoming origin is permitted.
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  const allowed = getAllowedOrigins();
  return allowed.includes(origin.toLowerCase());
}

/**
 * Handles CORS preflight OPTIONS requests for /api routes.
 */
export function handleCorsPreflight(request: NextRequest): NextResponse | null {
  if (request.method !== "OPTIONS") {
    return null;
  }

  const origin = request.headers.get("origin");
  const headers = new Headers({
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Requested-With, Accept, Origin",
    "Access-Control-Max-Age": "86400", // 24 hours
  });

  if (origin && isOriginAllowed(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
  }

  return new NextResponse(null, { status: 204, headers });
}

/**
 * Attaches restricted CORS headers to an outgoing NextResponse.
 */
export function applyCorsHeaders(
  response: NextResponse,
  request: NextRequest
): NextResponse {
  const origin = request.headers.get("origin");

  if (origin && isOriginAllowed(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    );
  }

  return response;
}

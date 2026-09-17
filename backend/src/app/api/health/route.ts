import { prisma } from "@/lib/prisma";
import { successResponse, handleApiError } from "@/lib/api-response";

/**
 * GET /api/health
 * Public, lightweight health check endpoint for monitoring, liveness, and deployment verification.
 * Does not require authentication and never exposes database credentials, secrets, or internal traces.
 */
export async function GET() {
  try {
    let databaseStatus = "connected";

    try {
      // Lightweight database ping (SELECT 1)
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      databaseStatus = "disconnected";
    }

    return successResponse({
      status: "ok",
      database: databaseStatus,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

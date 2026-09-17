import { requireRole, sanitizeUser } from "@/lib/auth";
import { successResponse, handleApiError } from "@/lib/api-response";
import { Role } from "@prisma/client";

/**
 * GET /api/auth/admin
 * Protected endpoint requiring the ADMIN role.
 */
export async function GET() {
  try {
    const user = await requireRole(Role.ADMIN);

    return successResponse({
      message: "Authorized as ADMIN",
      user: sanitizeUser(user),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

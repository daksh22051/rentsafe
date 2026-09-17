import { requireRole, sanitizeUser } from "@/lib/auth";
import { successResponse, handleApiError } from "@/lib/api-response";
import { Role } from "@prisma/client";

/**
 * GET /api/auth/owner
 * Protected endpoint requiring the OWNER role.
 */
export async function GET() {
  try {
    const user = await requireRole(Role.OWNER);

    return successResponse({
      message: "Authorized as OWNER",
      user: sanitizeUser(user),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

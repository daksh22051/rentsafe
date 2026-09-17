import { requireRole, sanitizeUser } from "@/lib/auth";
import { successResponse, handleApiError } from "@/lib/api-response";
import { Role } from "@prisma/client";

/**
 * GET /api/auth/student
 * Protected endpoint requiring the STUDENT role.
 */
export async function GET() {
  try {
    const user = await requireRole(Role.STUDENT);

    return successResponse({
      message: "Authorized as STUDENT",
      user: sanitizeUser(user),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

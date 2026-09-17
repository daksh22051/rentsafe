import { requireRole } from "@/lib/auth";
import {
  getMyPreferences,
  deleteMyPreferences,
} from "@/lib/services/roommate.service";
import { successResponse, handleApiError } from "@/lib/api-response";
import { Role } from "@prisma/client";

/**
 * GET /api/roommate-preferences/me
 * Retrieves the authenticated student's own roommate preference profile.
 */
export async function GET() {
  try {
    const user = await requireRole(Role.STUDENT);

    const preference = await getMyPreferences(user.id);
    return successResponse(preference);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/roommate-preferences/me
 * Deletes the authenticated student's roommate preference profile.
 */
export async function DELETE() {
  try {
    const user = await requireRole(Role.STUDENT);

    const result = await deleteMyPreferences(user.id);
    return successResponse(result, 200, result.message);
  } catch (error) {
    return handleApiError(error);
  }
}

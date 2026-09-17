import { requireRole } from "@/lib/auth";
import { getPropertiesByOwner } from "@/lib/services/property.service";
import { successResponse, handleApiError } from "@/lib/api-response";
import { Role } from "@prisma/client";

/**
 * GET /api/properties/my
 * Protected endpoint for OWNER role to list their own properties.
 * Exclusively uses the authenticated user's ID from session.
 */
export async function GET() {
  try {
    const user = await requireRole(Role.OWNER);

    const properties = await getPropertiesByOwner(user.id);
    return successResponse(properties);
  } catch (error) {
    return handleApiError(error);
  }
}

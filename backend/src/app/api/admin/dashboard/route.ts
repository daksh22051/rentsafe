import { requireRole } from "@/lib/auth";
import { getAdminDashboardSummary } from "@/lib/services/admin.service";
import { successResponse, handleApiError } from "@/lib/api-response";
import { Role } from "@prisma/client";

/**
 * GET /api/admin/dashboard
 * Retrieves aggregate platform statistics across users, properties, bookings,
 * complaints, and verifications.
 */
export async function GET() {
  try {
    await requireRole(Role.ADMIN);

    const summary = await getAdminDashboardSummary();
    return successResponse(summary);
  } catch (error) {
    return handleApiError(error);
  }
}

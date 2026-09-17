import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { adminBookingQuerySchema } from "@/lib/validations/admin";
import { getAdminBookings } from "@/lib/services/admin.service";
import { successResponse, handleApiError } from "@/lib/api-response";
import { Role } from "@prisma/client";

/**
 * GET /api/admin/bookings
 * Lists platform bookings with administrative filters and financial breakdown.
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole(Role.ADMIN);

    const searchParams = Object.fromEntries(
      request.nextUrl.searchParams.entries()
    );
    const validatedQuery = adminBookingQuerySchema.parse(searchParams);

    const result = await getAdminBookings(validatedQuery);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

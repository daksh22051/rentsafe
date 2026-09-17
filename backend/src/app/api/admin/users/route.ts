import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { adminUserQuerySchema } from "@/lib/validations/admin";
import { getAdminUsers } from "@/lib/services/admin.service";
import { successResponse, handleApiError } from "@/lib/api-response";
import { Role } from "@prisma/client";

/**
 * GET /api/admin/users
 * Lists paginated users across the platform with role and search filters.
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole(Role.ADMIN);

    const searchParams = Object.fromEntries(
      request.nextUrl.searchParams.entries()
    );
    const validatedQuery = adminUserQuerySchema.parse(searchParams);

    const result = await getAdminUsers(validatedQuery);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

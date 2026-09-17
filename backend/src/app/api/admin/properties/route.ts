import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { adminPropertyQuerySchema } from "@/lib/validations/admin";
import { getAdminProperties } from "@/lib/services/admin.service";
import { successResponse, handleApiError } from "@/lib/api-response";
import { Role } from "@prisma/client";

/**
 * GET /api/admin/properties
 * Lists platform properties with administrative filters, owner summaries, and counts.
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole(Role.ADMIN);

    const searchParams = Object.fromEntries(
      request.nextUrl.searchParams.entries()
    );
    const validatedQuery = adminPropertyQuerySchema.parse(searchParams);

    const result = await getAdminProperties(validatedQuery);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

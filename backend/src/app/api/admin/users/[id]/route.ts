import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { adminParamSchema } from "@/lib/validations/admin";
import { getAdminUserById } from "@/lib/services/admin.service";
import { successResponse, handleApiError } from "@/lib/api-response";
import { Role } from "@prisma/client";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/admin/users/[id]
 * Retrieves detailed administrative view of a user.
 */
export async function GET(_request: NextRequest, context: RouteParams) {
  void _request;
  try {
    await requireRole(Role.ADMIN);
    const { id } = await context.params;

    adminParamSchema.parse({ id });

    const user = await getAdminUserById(id);
    return successResponse(user);
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  adminParamSchema,
  updateUserRoleSchema,
} from "@/lib/validations/admin";
import { updateUserRole } from "@/lib/services/admin.service";
import { successResponse, handleApiError } from "@/lib/api-response";
import { Role } from "@prisma/client";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * PATCH /api/admin/users/[id]/role
 * Updates a user's role.
 * Includes self-protection and last-admin preservation.
 */
export async function PATCH(request: NextRequest, context: RouteParams) {
  try {
    const admin = await requireRole(Role.ADMIN);
    const { id } = await context.params;

    adminParamSchema.parse({ id });

    const body = await request.json();
    const validatedData = updateUserRoleSchema.parse(body);

    const result = await updateUserRole(id, admin.id, validatedData.role);
    return successResponse(result, 200, "User role updated successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

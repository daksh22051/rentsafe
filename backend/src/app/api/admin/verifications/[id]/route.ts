import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  verificationParamSchema,
  adminUpdateVerificationSchema,
} from "@/lib/validations/verification";
import { updateVerificationStatus } from "@/lib/services/verification.service";
import { successResponse, handleApiError } from "@/lib/api-response";
import { Role } from "@prisma/client";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * PATCH /api/admin/verifications/[id]
 * Updates verification status (approved, verified, rejected, under review) by an administrator.
 */
export async function PATCH(request: NextRequest, context: RouteParams) {
  try {
    const admin = await requireRole(Role.ADMIN);
    const { id } = await context.params;

    verificationParamSchema.parse({ id });

    const body = await request.json();
    const validatedData = adminUpdateVerificationSchema.parse(body);

    const result = await updateVerificationStatus(id, admin.id, validatedData);
    return successResponse(
      result,
      200,
      "Verification status updated successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

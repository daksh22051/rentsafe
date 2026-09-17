import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { verificationQuerySchema } from "@/lib/validations/verification";
import { getAdminVerifications } from "@/lib/services/verification.service";
import { successResponse, handleApiError } from "@/lib/api-response";
import { Role } from "@prisma/client";

/**
 * GET /api/admin/verifications
 * Lists all verification requests across the platform for administrators.
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole(Role.ADMIN);

    const searchParams = Object.fromEntries(
      request.nextUrl.searchParams.entries()
    );
    const validatedQuery = verificationQuerySchema.parse(searchParams);

    const result = await getAdminVerifications(validatedQuery);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

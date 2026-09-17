import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { verificationQuerySchema } from "@/lib/validations/verification";
import { getMyVerifications } from "@/lib/services/verification.service";
import { successResponse, handleApiError } from "@/lib/api-response";
import { Role } from "@prisma/client";

/**
 * GET /api/verifications/my
 * Retrieves paginated verification requests submitted by the authenticated owner.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(Role.OWNER);

    const searchParams = Object.fromEntries(
      request.nextUrl.searchParams.entries()
    );
    const validatedQuery = verificationQuerySchema.parse(searchParams);

    const result = await getMyVerifications(user.id, validatedQuery);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

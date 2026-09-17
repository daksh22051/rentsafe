import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { verificationParamSchema } from "@/lib/validations/verification";
import { getVerificationById } from "@/lib/services/verification.service";
import { successResponse, handleApiError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/verifications/[id]
 * Retrieves a single verification request with strict IDOR protections:
 * - OWNER: only for their own properties
 * - ADMIN: any verification
 * - STUDENT: forbidden
 */
export async function GET(_request: NextRequest, context: RouteParams) {
  void _request;
  try {
    const user = await requireUser();
    const { id } = await context.params;

    verificationParamSchema.parse({ id });

    const result = await getVerificationById(id, user);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

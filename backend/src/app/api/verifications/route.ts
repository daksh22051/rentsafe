import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { submitVerificationSchema } from "@/lib/validations/verification";
import { submitVerification } from "@/lib/services/verification.service";
import { successResponse, handleApiError } from "@/lib/api-response";
import { Role } from "@prisma/client";

/**
 * POST /api/verifications
 * Submits a new verification request for a property by its authenticated owner.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(Role.OWNER);

    const body = await request.json();
    const validatedData = submitVerificationSchema.parse(body);

    const result = await submitVerification(user.id, validatedData);
    return successResponse(
      result,
      201,
      "Verification request submitted successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

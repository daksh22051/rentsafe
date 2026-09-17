import { NextRequest } from "next/server";
import { getCurrentProfile, requireUser, sanitizeUser } from "@/lib/auth";
import { updateProfileSchema } from "@/lib/validations";
import { prisma } from "@/lib/prisma";
import { successResponse, handleApiError } from "@/lib/api-response";

/**
 * GET /api/auth/me
 * Returns the currently authenticated user profile with associated profiles.
 */
export async function GET() {
  try {
    const profile = await getCurrentProfile();
    return successResponse(profile);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/auth/me
 * Updates allowed profile fields (name, phone, avatarUrl).
 * Strictly forbids updating role, id, or email through this endpoint.
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser();

    const body = await request.json();
    const validatedData = updateProfileSchema.parse(body);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(validatedData.name !== undefined ? { name: validatedData.name } : {}),
        ...(validatedData.phone !== undefined ? { phone: validatedData.phone } : {}),
        ...(validatedData.avatarUrl !== undefined ? { avatarUrl: validatedData.avatarUrl } : {}),
      },
    });

    return successResponse(
      sanitizeUser(updatedUser),
      200,
      "Profile updated successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

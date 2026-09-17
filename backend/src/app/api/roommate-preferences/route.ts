import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { roommatePreferenceSchema } from "@/lib/validations/roommate";
import { upsertPreferences } from "@/lib/services/roommate.service";
import { successResponse, handleApiError } from "@/lib/api-response";
import { Role } from "@prisma/client";

/**
 * PUT /api/roommate-preferences
 * Creates or updates the authenticated student's roommate preference profile.
 * Restricted strictly to STUDENT role.
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await requireRole(Role.STUDENT);

    const body = await request.json();
    const validatedData = roommatePreferenceSchema.parse(body);

    const { preference, isNew } = await upsertPreferences(user.id, validatedData);

    return successResponse(
      preference,
      isNew ? 201 : 200,
      isNew
        ? "Roommate preferences created successfully"
        : "Roommate preferences updated successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

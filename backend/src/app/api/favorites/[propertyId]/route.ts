import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { favoriteParamSchema } from "@/lib/validations/favorite";
import {
  getFavoriteStatus,
  removeFavorite,
} from "@/lib/services/favorite.service";
import { successResponse, handleApiError } from "@/lib/api-response";
import { Role } from "@prisma/client";

interface RouteParams {
  params: Promise<{
    propertyId: string;
  }>;
}

/**
 * GET /api/favorites/[propertyId]
 * Checks whether a specific property is favorited by the authenticated student.
 */
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const user = await requireRole(Role.STUDENT);
    const { propertyId } = await context.params;

    favoriteParamSchema.parse({ propertyId });

    const status = await getFavoriteStatus(user.id, propertyId);
    return successResponse(status);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/favorites/[propertyId]
 * Removes a property from the authenticated student's favorites list.
 */
export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    const user = await requireRole(Role.STUDENT);
    const { propertyId } = await context.params;

    favoriteParamSchema.parse({ propertyId });

    const result = await removeFavorite(user.id, propertyId);
    return successResponse(result, 200, result.message);
  } catch (error) {
    return handleApiError(error);
  }
}

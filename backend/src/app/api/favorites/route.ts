import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  createFavoriteSchema,
  favoriteQuerySchema,
} from "@/lib/validations/favorite";
import {
  addFavorite,
  getFavorites,
} from "@/lib/services/favorite.service";
import { successResponse, handleApiError } from "@/lib/api-response";
import { Role } from "@prisma/client";

/**
 * GET /api/favorites
 * Retrieves paginated list of favorites belonging exclusively to the authenticated student.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(Role.STUDENT);

    const searchParams = Object.fromEntries(
      request.nextUrl.searchParams.entries()
    );
    const validatedQuery = favoriteQuerySchema.parse(searchParams);

    const result = await getFavorites(user.id, validatedQuery);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/favorites
 * Adds a property to favorites for the authenticated student.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(Role.STUDENT);

    const body = await request.json();
    const validatedData = createFavoriteSchema.parse(body);

    const favorite = await addFavorite(user.id, validatedData.propertyId);
    return successResponse(
      favorite,
      201,
      "Property added to favorites"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

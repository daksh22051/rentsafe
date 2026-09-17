import { NextRequest } from "next/server";
import { amenityQuerySchema } from "@/lib/validations/amenity";
import { getAllAmenities } from "@/lib/services/amenity.service";
import { successResponse, handleApiError } from "@/lib/api-response";

/**
 * GET /api/amenities
 * Public endpoint to retrieve the platform amenity catalog.
 * Optional query parameter: ?category=Essentials
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const query = amenityQuerySchema.parse(searchParams);

    const amenities = await getAllAmenities(query.category);
    return successResponse(amenities);
  } catch (error) {
    return handleApiError(error);
  }
}

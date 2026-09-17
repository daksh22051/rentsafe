import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { syncAmenitiesSchema } from "@/lib/validations/amenity";
import { syncPropertyAmenities } from "@/lib/services/amenity.service";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  handleApiError,
  AuthException,
} from "@/lib/api-response";
import { Role } from "@prisma/client";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/properties/[id]/amenities
 * Public endpoint to retrieve amenities attached to a specific property.
 */
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const { id } = await context.params;

    const property = await prisma.property.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!property) {
      throw new AuthException(404, "PROPERTY_NOT_FOUND", "Property not found");
    }

    const propertyAmenities = await prisma.propertyAmenity.findMany({
      where: { propertyId: id },
      include: {
        amenity: {
          select: {
            id: true,
            name: true,
            category: true,
            icon: true,
          },
        },
      },
      orderBy: {
        amenity: {
          name: "asc",
        },
      },
    });

    return successResponse(propertyAmenities.map((pa) => pa.amenity));
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/properties/[id]/amenities
 * Protected endpoint for OWNER (or ADMIN) to attach/synchronize amenities to their property.
 * Replaces property-amenity links atomically using existing catalog records.
 */
export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    const { id } = await context.params;
    const user = await requireUser();

    if (user.role !== Role.OWNER && user.role !== Role.ADMIN) {
      throw new AuthException(
        403,
        "FORBIDDEN",
        "Only property owners or admins can manage property amenities"
      );
    }

    const body = await request.json();
    const validatedData = syncAmenitiesSchema.parse(body);

    const updatedAmenities = await syncPropertyAmenities(
      id,
      user.id,
      user.role,
      validatedData.amenityIds
    );

    return successResponse(
      updatedAmenities,
      200,
      "Property amenities updated successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

import { prisma } from "@/lib/prisma";
import { AuthException } from "@/lib/api-response";
import { Role } from "@prisma/client";

/**
 * Retrieves the platform amenity catalog.
 * Publicly accessible for discovery and owner selection.
 */
export async function getAllAmenities(category?: string) {
  return prisma.amenity.findMany({
    where: category ? { category: { equals: category, mode: "insensitive" } } : undefined,
    select: {
      id: true,
      name: true,
      category: true,
      icon: true,
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}

/**
 * Attaches/synchronizes amenities to a property owned by the authenticated user.
 * Atomic transaction replaces property amenities safely.
 * Prevents client from creating arbitrary/duplicate amenities.
 */
export async function syncPropertyAmenities(
  propertyId: string,
  userId: string,
  userRole: Role,
  amenityIds: string[]
) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, ownerId: true },
  });

  if (!property) {
    throw new AuthException(404, "PROPERTY_NOT_FOUND", "Property not found");
  }

  if (userRole !== Role.ADMIN && property.ownerId !== userId) {
    throw new AuthException(
      403,
      "FORBIDDEN",
      "You do not have permission to manage amenities for this property"
    );
  }

  // Deduplicate amenity IDs
  const uniqueAmenityIds = Array.from(new Set(amenityIds));

  // Verify all supplied amenity IDs actually exist in the Amenity catalog
  if (uniqueAmenityIds.length > 0) {
    const existingCount = await prisma.amenity.count({
      where: {
        id: { in: uniqueAmenityIds },
      },
    });

    if (existingCount !== uniqueAmenityIds.length) {
      throw new AuthException(
        400,
        "AMENITY_NOT_FOUND",
        "One or more supplied amenity IDs do not exist in the platform catalog"
      );
    }
  }

  // Atomic transaction to clear existing amenities and attach new ones
  await prisma.$transaction(async (tx) => {
    await tx.propertyAmenity.deleteMany({
      where: { propertyId },
    });

    if (uniqueAmenityIds.length > 0) {
      await tx.propertyAmenity.createMany({
        data: uniqueAmenityIds.map((amenityId) => ({
          propertyId,
          amenityId,
        })),
      });
    }
  });

  // Return attached amenities in clean public shape
  const updatedPropertyAmenities = await prisma.propertyAmenity.findMany({
    where: { propertyId },
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

  return updatedPropertyAmenities.map((pa) => pa.amenity);
}

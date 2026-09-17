import { prisma } from "@/lib/prisma";
import { AuthException } from "@/lib/api-response";
import {
  CreatePropertyInput,
  UpdatePropertyInput,
  PropertyQueryInput,
} from "@/lib/validations/property";
import { Prisma, PropertyVerificationStatus, BookingStatus } from "@prisma/client";

export interface PaginatedProperties<T> {
  properties: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Creates a new property listing for the authenticated owner.
 * Client cannot manipulate ownerId, trustScore, or verificationStatus.
 */
export async function createProperty(
  ownerId: string,
  input: CreatePropertyInput
) {
  const { amenityIds, availableFrom, ...propertyData } = input;

  const property = await prisma.property.create({
    data: {
      ...propertyData,
      ownerId,
      availableFrom: availableFrom ? new Date(availableFrom) : null,
      verificationStatus: PropertyVerificationStatus.UNVERIFIED,
      trustScore: 0.0,
      amenities:
        amenityIds && amenityIds.length > 0
          ? {
              create: amenityIds.map((amenityId) => ({
                amenity: { connect: { id: amenityId } },
              })),
            }
          : undefined,
    },
    include: {
      images: { orderBy: { displayOrder: "asc" } },
      rooms: true,
      amenities: { include: { amenity: true } },
    },
  });

  return property;
}

/**
 * Retrieves public properties with filtering and pagination.
 * Excludes private owner KYC or sensitive internal fields.
 */
export async function getProperties(params: PropertyQueryInput) {
  const {
    city,
    minRent,
    maxRent,
    propertyType,
    furnishedStatus,
    foodInfo,
    hasWifi,
    verificationStatus,
    isAvailable,
    roomType,
    amenityId,
    roomAvailable,
    page = 1,
    limit = 20,
  } = params;

  const skip = (page - 1) * limit;

  // Construct parameterized filter conditions
  const where: Prisma.PropertyWhereInput = {
    ...(isAvailable !== undefined ? { isAvailable } : {}),
    ...(city ? { city: { equals: city, mode: "insensitive" } } : {}),
    ...(propertyType ? { propertyType } : {}),
    ...(furnishedStatus ? { furnishedStatus } : {}),
    ...(foodInfo ? { foodInfo } : {}),
    ...(hasWifi !== undefined ? { hasWifi } : {}),
    ...(verificationStatus ? { verificationStatus } : {}),
    ...(minRent || maxRent
      ? {
          rent: {
            ...(minRent ? { gte: minRent } : {}),
            ...(maxRent ? { lte: maxRent } : {}),
          },
        }
      : {}),
    ...(roomType || roomAvailable !== undefined
      ? {
          rooms: {
            some: {
              ...(roomType ? { roomType } : {}),
              ...(roomAvailable !== undefined
                ? { isAvailable: roomAvailable }
                : {}),
            },
          },
        }
      : {}),
    ...(amenityId
      ? {
          amenities: {
            some: {
              amenityId,
            },
          },
        }
      : {}),
  };

  const [total, properties] = await Promise.all([
    prisma.property.count({ where }),
    prisma.property.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        images: {
          orderBy: { displayOrder: "asc" },
          take: 5,
        },
        rooms: {
          where: { isAvailable: true },
          select: {
            id: true,
            roomType: true,
            rent: true,
            isAvailable: true,
            capacity: true,
          },
        },
        amenities: {
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
        },
        owner: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    }),
  ]);

  return {
    properties,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Retrieves full details for a single property by ID.
 * Returns public property details and review summary.
 */
export async function getPropertyById(id: string) {
  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      images: { orderBy: { displayOrder: "asc" } },
      rooms: true,
      amenities: {
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
      },
      owner: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
      reviews: {
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          reviewer: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      },
      _count: {
        select: {
          reviews: true,
          favorites: true,
        },
      },
    },
  });

  if (!property) {
    throw new AuthException(404, "NOT_FOUND", "Property not found");
  }

  // Calculate review score aggregates if reviews exist
  const reviewCount = property._count.reviews;
  let averageRating = 0;

  if (reviewCount > 0 && property.reviews.length > 0) {
    const sum = property.reviews.reduce(
      (acc, rev) => acc + rev.overallRating,
      0
    );
    averageRating = Number((sum / property.reviews.length).toFixed(1));
  }

  return {
    ...property,
    reviewStats: {
      totalReviews: reviewCount,
      averageRating,
    },
  };
}

/**
 * Retrieves all properties owned by the authenticated owner.
 */
export async function getPropertiesByOwner(ownerId: string) {
  return prisma.property.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    include: {
      images: { orderBy: { displayOrder: "asc" } },
      rooms: true,
      amenities: {
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
      },
      verifications: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      _count: {
        select: {
          bookings: true,
          reviews: true,
          complaints: true,
        },
      },
    },
  });
}

/**
 * Updates an existing property owned by the authenticated owner.
 * Strictly verifies ownership and prevents unauthorized field mutation.
 */
export async function updateProperty(
  id: string,
  ownerId: string,
  input: UpdatePropertyInput
) {
  const existingProperty = await prisma.property.findUnique({
    where: { id },
  });

  if (!existingProperty) {
    throw new AuthException(404, "NOT_FOUND", "Property not found");
  }

  if (existingProperty.ownerId !== ownerId) {
    throw new AuthException(
      403,
      "FORBIDDEN",
      "You do not have permission to modify this property"
    );
  }

  const { amenityIds, availableFrom, ...updateData } = input;

  // Handle amenity updates if provided
  if (amenityIds !== undefined) {
    await prisma.$transaction([
      prisma.propertyAmenity.deleteMany({
        where: { propertyId: id },
      }),
      ...(amenityIds.length > 0
        ? [
            prisma.propertyAmenity.createMany({
              data: amenityIds.map((amenityId) => ({
                propertyId: id,
                amenityId,
              })),
            }),
          ]
        : []),
    ]);
  }

  const updated = await prisma.property.update({
    where: { id },
    data: {
      ...updateData,
      ...(availableFrom !== undefined
        ? { availableFrom: availableFrom ? new Date(availableFrom) : null }
        : {}),
    },
    include: {
      images: { orderBy: { displayOrder: "asc" } },
      rooms: true,
      amenities: { include: { amenity: true } },
    },
  });

  return updated;
}

/**
 * Deletes a property owned by the authenticated owner.
 * Respects referential integrity and checks for active/pending bookings.
 */
export async function deleteProperty(id: string, ownerId: string) {
  const existingProperty = await prisma.property.findUnique({
    where: { id },
  });

  if (!existingProperty) {
    throw new AuthException(404, "NOT_FOUND", "Property not found");
  }

  if (existingProperty.ownerId !== ownerId) {
    throw new AuthException(
      403,
      "FORBIDDEN",
      "You do not have permission to delete this property"
    );
  }

  // Check if there are active or pending bookings preventing deletion
  const activeBookingsCount = await prisma.booking.count({
    where: {
      propertyId: id,
      status: {
        in: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
      },
    },
  });

  if (activeBookingsCount > 0) {
    throw new AuthException(
      409,
      "CONFLICT",
      "Cannot delete property with active or pending bookings"
    );
  }

  try {
    await prisma.property.delete({
      where: { id },
    });
    return { success: true, message: "Property deleted successfully" };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      throw new AuthException(
        409,
        "CONFLICT",
        "Cannot delete property due to associated records"
      );
    }
    throw error;
  }
}

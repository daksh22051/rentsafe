import { prisma } from "@/lib/prisma";
import { AuthException } from "@/lib/api-response";
import { FavoriteQueryInput } from "@/lib/validations/favorite";
import { Prisma } from "@prisma/client";

/**
 * Adds a property to the authenticated student's favorites list.
 * Validates property existence and prevents duplicate favorites.
 */
export async function addFavorite(userId: string, propertyId: string) {
  // 1. Verify property exists
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true },
  });

  if (!property) {
    throw new AuthException(404, "PROPERTY_NOT_FOUND", "Property not found");
  }

  // 2. Check for existing favorite
  const existingFavorite = await prisma.favorite.findUnique({
    where: {
      userId_propertyId: {
        userId,
        propertyId,
      },
    },
  });

  if (existingFavorite) {
    throw new AuthException(
      409,
      "FAVORITE_ALREADY_EXISTS",
      "Property is already in your favorites"
    );
  }

  // 3. Create favorite with race condition handling for unique constraint
  try {
    const favorite = await prisma.favorite.create({
      data: {
        userId,
        propertyId,
      },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            propertyType: true,
            address: true,
            city: true,
            rent: true,
            securityDeposit: true,
            furnishedStatus: true,
            foodInfo: true,
            hasWifi: true,
            isAvailable: true,
            verificationStatus: true,
            trustScore: true,
            createdAt: true,
            images: {
              orderBy: { displayOrder: "asc" },
              take: 1,
            },
          },
        },
      },
    });

    return favorite;
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AuthException(
        409,
        "FAVORITE_ALREADY_EXISTS",
        "Property is already in your favorites"
      );
    }
    throw error;
  }
}

/**
 * Removes a property from the authenticated student's favorites list.
 * Scoped strictly to the student's own favorite record.
 */
export async function removeFavorite(userId: string, propertyId: string) {
  // 1. Verify the favorite exists for this user
  const favorite = await prisma.favorite.findUnique({
    where: {
      userId_propertyId: {
        userId,
        propertyId,
      },
    },
  });

  if (!favorite) {
    throw new AuthException(
      404,
      "FAVORITE_NOT_FOUND",
      "Property is not in your favorites"
    );
  }

  // 2. Delete the user's favorite
  await prisma.favorite.delete({
    where: {
      userId_propertyId: {
        userId,
        propertyId,
      },
    },
  });

  return { message: "Property removed from favorites successfully" };
}

/**
 * Retrieves paginated list of favorites belonging exclusively to the authenticated student.
 * Sanitizes property fields to prevent exposing owner KYC, passwords, or tokens.
 */
export async function getFavorites(userId: string, query: FavoriteQueryInput) {
  const page = query.page || 1;
  const limit = Math.min(query.limit || 20, 100);
  const skip = (page - 1) * limit;

  const [total, favorites] = await Promise.all([
    prisma.favorite.count({
      where: { userId },
    }),
    prisma.favorite.findMany({
      where: { userId },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            description: true,
            propertyType: true,
            address: true,
            city: true,
            state: true,
            pincode: true,
            landmark: true,
            latitude: true,
            longitude: true,
            rent: true,
            securityDeposit: true,
            furnishedStatus: true,
            foodInfo: true,
            foodDescription: true,
            hasWifi: true,
            wifiSpeedMbps: true,
            isAvailable: true,
            availableFrom: true,
            verificationStatus: true,
            trustScore: true,
            totalRooms: true,
            totalBeds: true,
            createdAt: true,
            images: {
              orderBy: { displayOrder: "asc" },
            },
          },
        },
      },
    }),
  ]);

  return {
    favorites,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Checks whether a specific property is favorited by the authenticated student.
 * Verifies property existence first; returns 404 if property doesn't exist.
 */
export async function getFavoriteStatus(userId: string, propertyId: string) {
  // 1. Verify property exists
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true },
  });

  if (!property) {
    throw new AuthException(404, "PROPERTY_NOT_FOUND", "Property not found");
  }

  // 2. Check if favorited by user
  const favorite = await prisma.favorite.findUnique({
    where: {
      userId_propertyId: {
        userId,
        propertyId,
      },
    },
  });

  return {
    propertyId,
    isFavorite: !!favorite,
  };
}

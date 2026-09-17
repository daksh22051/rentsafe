import { prisma } from "@/lib/prisma";
import { AuthException } from "@/lib/api-response";
import {
  CreatePropertyImageInput,
  UpdatePropertyImageInput,
} from "@/lib/validations/property-image";
import { Role } from "@prisma/client";

/**
 * Retrieves all images for a given property.
 * Publicly viewable ordered by displayOrder.
 */
export async function getImagesByPropertyId(propertyId: string) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true },
  });

  if (!property) {
    throw new AuthException(404, "PROPERTY_NOT_FOUND", "Property not found");
  }

  return prisma.propertyImage.findMany({
    where: { propertyId },
    orderBy: [{ isCover: "desc" }, { displayOrder: "asc" }, { createdAt: "asc" }],
  });
}

/**
 * Adds an image metadata record to a property.
 * If isCover is true, atomically unsets any existing cover image for the property.
 */
export async function createPropertyImage(
  propertyId: string,
  userId: string,
  userRole: Role,
  input: CreatePropertyImageInput
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
      "PROPERTY_IMAGE_ACCESS_DENIED",
      "You do not have permission to manage images for this property"
    );
  }

  if (input.isCover) {
    return prisma.$transaction(async (tx) => {
      // Unset previous cover image
      await tx.propertyImage.updateMany({
        where: { propertyId, isCover: true },
        data: { isCover: false },
      });

      return tx.propertyImage.create({
        data: {
          propertyId,
          url: input.url,
          caption: input.caption ?? null,
          displayOrder: input.displayOrder,
          isCover: true,
        },
      });
    });
  }

  return prisma.propertyImage.create({
    data: {
      propertyId,
      url: input.url,
      caption: input.caption ?? null,
      displayOrder: input.displayOrder,
      isCover: input.isCover,
    },
  });
}

/**
 * Updates an image's metadata (caption, displayOrder, isCover).
 * If isCover is set to true, atomically unsets any other cover image.
 */
export async function updatePropertyImage(
  propertyId: string,
  imageId: string,
  userId: string,
  userRole: Role,
  input: UpdatePropertyImageInput
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
      "PROPERTY_IMAGE_ACCESS_DENIED",
      "You do not have permission to update images for this property"
    );
  }

  const existingImage = await prisma.propertyImage.findUnique({
    where: { id: imageId },
  });

  if (!existingImage || existingImage.propertyId !== propertyId) {
    throw new AuthException(
      404,
      "PROPERTY_IMAGE_NOT_FOUND",
      "Image not found for this property"
    );
  }

  if (input.isCover === true) {
    return prisma.$transaction(async (tx) => {
      await tx.propertyImage.updateMany({
        where: { propertyId, isCover: true, id: { not: imageId } },
        data: { isCover: false },
      });

      return tx.propertyImage.update({
        where: { id: imageId },
        data: {
          ...(input.caption !== undefined ? { caption: input.caption } : {}),
          ...(input.displayOrder !== undefined
            ? { displayOrder: input.displayOrder }
            : {}),
          isCover: true,
        },
      });
    });
  }

  return prisma.propertyImage.update({
    where: { id: imageId },
    data: {
      ...(input.caption !== undefined ? { caption: input.caption } : {}),
      ...(input.displayOrder !== undefined
        ? { displayOrder: input.displayOrder }
        : {}),
      ...(input.isCover !== undefined ? { isCover: input.isCover } : {}),
    },
  });
}

/**
 * Deletes an image metadata record.
 * If the deleted image was the cover image, automatically designates the first remaining image as cover.
 */
export async function deletePropertyImage(
  propertyId: string,
  imageId: string,
  userId: string,
  userRole: Role
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
      "PROPERTY_IMAGE_ACCESS_DENIED",
      "You do not have permission to delete images for this property"
    );
  }

  const existingImage = await prisma.propertyImage.findUnique({
    where: { id: imageId },
  });

  if (!existingImage || existingImage.propertyId !== propertyId) {
    throw new AuthException(
      404,
      "PROPERTY_IMAGE_NOT_FOUND",
      "Image not found for this property"
    );
  }

  if (existingImage.isCover) {
    await prisma.$transaction(async (tx) => {
      await tx.propertyImage.delete({
        where: { id: imageId },
      });

      // Find first remaining image to become the new cover
      const nextCover = await tx.propertyImage.findFirst({
        where: { propertyId },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      });

      if (nextCover) {
        await tx.propertyImage.update({
          where: { id: nextCover.id },
          data: { isCover: true },
        });
      }
    });
  } else {
    await prisma.propertyImage.delete({
      where: { id: imageId },
    });
  }

  return { id: imageId, deleted: true };
}

import { prisma } from "@/lib/prisma";
import { AuthException } from "@/lib/api-response";
import {
  CreateRoomInput,
  UpdateRoomInput,
  RoomQueryInput,
} from "@/lib/validations/room";
import { Prisma, Role } from "@prisma/client";

/**
 * Retrieves rooms belonging to a public property.
 * Accessible by students, owners, and admins.
 */
export async function getRoomsByPropertyId(
  propertyId: string,
  filters?: RoomQueryInput
) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, isAvailable: true },
  });

  if (!property) {
    throw new AuthException(404, "PROPERTY_NOT_FOUND", "Property not found");
  }

  const where: Prisma.RoomWhereInput = {
    propertyId,
    ...(filters?.isAvailable !== undefined
      ? { isAvailable: filters.isAvailable }
      : {}),
    ...(filters?.roomType ? { roomType: filters.roomType } : {}),
  };

  return prisma.room.findMany({
    where,
    orderBy: [
      { isAvailable: "desc" },
      { roomNumber: "asc" },
      { createdAt: "asc" },
    ],
  });
}

/**
 * Creates a new room under the specified property.
 * Enforces ownership check (IDOR protection) and valid capacity/occupancy values.
 */
export async function createRoom(
  propertyId: string,
  userId: string,
  userRole: Role,
  input: CreateRoomInput
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
      "ROOM_ACCESS_DENIED",
      "You do not have permission to manage rooms for this property"
    );
  }

  if (input.currentOccupancy > input.capacity) {
    throw new AuthException(
      400,
      "INVALID_ROOM",
      "Current occupancy cannot exceed room capacity"
    );
  }

  // If occupancy equals or exceeds capacity, automatically mark as not available
  const isAvailable =
    input.currentOccupancy >= input.capacity ? false : input.isAvailable;

  const room = await prisma.room.create({
    data: {
      propertyId,
      roomNumber: input.roomNumber ?? null,
      roomType: input.roomType,
      rent: new Prisma.Decimal(input.rent),
      securityDeposit:
        input.securityDeposit !== undefined && input.securityDeposit !== null
          ? new Prisma.Decimal(input.securityDeposit)
          : null,
      capacity: input.capacity,
      currentOccupancy: input.currentOccupancy,
      isAvailable,
      hasAttachedBathroom: input.hasAttachedBathroom,
      hasBalcony: input.hasBalcony,
      hasAc: input.hasAc,
      description: input.description ?? null,
    },
  });

  return room;
}

/**
 * Updates an existing room.
 * Validates ownership, relationship, and occupancy consistency.
 */
export async function updateRoom(
  propertyId: string,
  roomId: string,
  userId: string,
  userRole: Role,
  input: UpdateRoomInput
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
      "ROOM_ACCESS_DENIED",
      "You do not have permission to update rooms for this property"
    );
  }

  const existingRoom = await prisma.room.findUnique({
    where: { id: roomId },
  });

  if (!existingRoom || existingRoom.propertyId !== propertyId) {
    throw new AuthException(
      404,
      "ROOM_NOT_FOUND",
      "Room not found in this property"
    );
  }

  const resolvedCapacity = input.capacity ?? existingRoom.capacity;
  const resolvedOccupancy = input.currentOccupancy ?? existingRoom.currentOccupancy;

  if (resolvedOccupancy > resolvedCapacity) {
    throw new AuthException(
      400,
      "INVALID_ROOM",
      "Current occupancy cannot exceed room capacity"
    );
  }

  // Determine availability if occupancy filled capacity and availability was not explicitly supplied
  let isAvailable = input.isAvailable;
  if (isAvailable === undefined && resolvedOccupancy >= resolvedCapacity) {
    isAvailable = false;
  }

  const updatedRoom = await prisma.room.update({
    where: { id: roomId },
    data: {
      ...(input.roomNumber !== undefined ? { roomNumber: input.roomNumber } : {}),
      ...(input.roomType ? { roomType: input.roomType } : {}),
      ...(input.rent !== undefined
        ? { rent: new Prisma.Decimal(input.rent) }
        : {}),
      ...(input.securityDeposit !== undefined
        ? {
            securityDeposit:
              input.securityDeposit !== null
                ? new Prisma.Decimal(input.securityDeposit)
                : null,
          }
        : {}),
      ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
      ...(input.currentOccupancy !== undefined
        ? { currentOccupancy: input.currentOccupancy }
        : {}),
      ...(isAvailable !== undefined ? { isAvailable } : {}),
      ...(input.hasAttachedBathroom !== undefined
        ? { hasAttachedBathroom: input.hasAttachedBathroom }
        : {}),
      ...(input.hasBalcony !== undefined
        ? { hasBalcony: input.hasBalcony }
        : {}),
      ...(input.hasAc !== undefined ? { hasAc: input.hasAc } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
    },
  });

  return updatedRoom;
}

/**
 * Deletes a room from inventory.
 * Delete safety: checks if any booking references this room before deleting.
 */
export async function deleteRoom(
  propertyId: string,
  roomId: string,
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
      "ROOM_ACCESS_DENIED",
      "You do not have permission to delete rooms for this property"
    );
  }

  const existingRoom = await prisma.room.findUnique({
    where: { id: roomId },
  });

  if (!existingRoom || existingRoom.propertyId !== propertyId) {
    throw new AuthException(
      404,
      "ROOM_NOT_FOUND",
      "Room not found in this property"
    );
  }

  // DELETE SAFETY: Prevent deletion if there is booking history on this room
  const bookingCount = await prisma.booking.count({
    where: { roomId },
  });

  if (bookingCount > 0) {
    throw new AuthException(
      400,
      "ROOM_DELETE_NOT_ALLOWED",
      "Cannot delete room that has existing booking history. Mark it as unavailable instead."
    );
  }

  await prisma.room.delete({
    where: { id: roomId },
  });

  return { id: roomId, deleted: true };
}

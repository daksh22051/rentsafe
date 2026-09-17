import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { updateRoomSchema } from "@/lib/validations/room";
import { updateRoom, deleteRoom } from "@/lib/services/room.service";
import {
  successResponse,
  handleApiError,
  AuthException,
} from "@/lib/api-response";
import { Role } from "@prisma/client";

interface RouteParams {
  params: Promise<{
    id: string;
    roomId: string;
  }>;
}

/**
 * PATCH /api/properties/[id]/rooms/[roomId]
 * Protected endpoint for OWNER (or ADMIN) to update room details.
 * Prevents impossible occupancy values and preserves ownership security.
 */
export async function PATCH(request: NextRequest, context: RouteParams) {
  try {
    const { id, roomId } = await context.params;
    const user = await requireUser();

    if (user.role !== Role.OWNER && user.role !== Role.ADMIN) {
      throw new AuthException(
        403,
        "FORBIDDEN",
        "Only property owners or admins can update rooms"
      );
    }

    const body = await request.json();
    const validatedData = updateRoomSchema.parse(body);

    const updatedRoom = await updateRoom(
      id,
      roomId,
      user.id,
      user.role,
      validatedData
    );
    return successResponse(updatedRoom, 200, "Room updated successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/properties/[id]/rooms/[roomId]
 * Protected endpoint for OWNER (or ADMIN) to delete a room.
 * Delete safety: rejects deletion if existing bookings reference this room.
 */
export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    const { id, roomId } = await context.params;
    const user = await requireUser();

    if (user.role !== Role.OWNER && user.role !== Role.ADMIN) {
      throw new AuthException(
        403,
        "FORBIDDEN",
        "Only property owners or admins can delete rooms"
      );
    }

    const result = await deleteRoom(id, roomId, user.id, user.role);
    return successResponse(result, 200, "Room deleted successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

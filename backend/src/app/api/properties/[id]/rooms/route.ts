import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  createRoomSchema,
  roomQuerySchema,
} from "@/lib/validations/room";
import {
  getRoomsByPropertyId,
  createRoom,
} from "@/lib/services/room.service";
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
 * GET /api/properties/[id]/rooms
 * Public endpoint to retrieve all rooms belonging to a property.
 * Supports query filtering by availability (isAvailable) and roomType.
 */
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const { id } = await context.params;
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const query = roomQuerySchema.parse(searchParams);

    const rooms = await getRoomsByPropertyId(id, query);
    return successResponse(rooms);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/properties/[id]/rooms
 * Protected endpoint for Property OWNER (or ADMIN) to add a room.
 * Rejects unexpected fields and prevents IDOR.
 */
export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const { id } = await context.params;
    const user = await requireUser();

    if (user.role !== Role.OWNER && user.role !== Role.ADMIN) {
      throw new AuthException(
        403,
        "FORBIDDEN",
        "Only property owners or admins can add rooms"
      );
    }

    const body = await request.json();
    const validatedData = createRoomSchema.parse(body);

    const room = await createRoom(id, user.id, user.role, validatedData);
    return successResponse(room, 201, "Room created successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

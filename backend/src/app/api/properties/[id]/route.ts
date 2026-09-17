import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { updatePropertySchema } from "@/lib/validations/property";
import {
  getPropertyById,
  updateProperty,
  deleteProperty,
} from "@/lib/services/property.service";
import { successResponse, handleApiError } from "@/lib/api-response";
import { Role } from "@prisma/client";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/properties/[id]
 * Public endpoint to retrieve full details for a single property.
 */
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const { id } = await context.params;
    const property = await getPropertyById(id);
    return successResponse(property);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/properties/[id]
 * Protected endpoint for OWNER to update their property details.
 * Strictly verifies property ownership and prohibits tampering with protected fields.
 */
export async function PATCH(request: NextRequest, context: RouteParams) {
  try {
    const { id } = await context.params;
    const user = await requireRole(Role.OWNER);

    const body = await request.json();
    const validatedData = updatePropertySchema.parse(body);

    const updated = await updateProperty(id, user.id, validatedData);
    return successResponse(updated, 200, "Property updated successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/properties/[id]
 * Protected endpoint for OWNER to delete their property.
 * Enforces ownership checks and blocks deletion if active/pending bookings exist.
 */
export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    const { id } = await context.params;
    const user = await requireRole(Role.OWNER);

    const result = await deleteProperty(id, user.id);
    return successResponse(result, 200, "Property deleted successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

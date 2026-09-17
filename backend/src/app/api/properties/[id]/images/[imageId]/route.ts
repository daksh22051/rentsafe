import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { updatePropertyImageSchema } from "@/lib/validations/property-image";
import {
  updatePropertyImage,
  deletePropertyImage,
} from "@/lib/services/property-image.service";
import {
  successResponse,
  handleApiError,
  AuthException,
} from "@/lib/api-response";
import { Role } from "@prisma/client";

interface RouteParams {
  params: Promise<{
    id: string;
    imageId: string;
  }>;
}

/**
 * PATCH /api/properties/[id]/images/[imageId]
 * Protected endpoint for OWNER (or ADMIN) to update image metadata.
 * Manages caption, display order, and atomic cover photo switching.
 */
export async function PATCH(request: NextRequest, context: RouteParams) {
  try {
    const { id, imageId } = await context.params;
    const user = await requireUser();

    if (user.role !== Role.OWNER && user.role !== Role.ADMIN) {
      throw new AuthException(
        403,
        "FORBIDDEN",
        "Only property owners or admins can update property images"
      );
    }

    const body = await request.json();
    const validatedData = updatePropertyImageSchema.parse(body);

    const updatedImage = await updatePropertyImage(
      id,
      imageId,
      user.id,
      user.role,
      validatedData
    );
    return successResponse(updatedImage, 200, "Image updated successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/properties/[id]/images/[imageId]
 * Protected endpoint for OWNER (or ADMIN) to delete image metadata.
 * If the deleted image was cover, automatically designates the next remaining image.
 */
export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    const { id, imageId } = await context.params;
    const user = await requireUser();

    if (user.role !== Role.OWNER && user.role !== Role.ADMIN) {
      throw new AuthException(
        403,
        "FORBIDDEN",
        "Only property owners or admins can delete property images"
      );
    }

    const result = await deletePropertyImage(
      id,
      imageId,
      user.id,
      user.role
    );
    return successResponse(result, 200, "Image deleted successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

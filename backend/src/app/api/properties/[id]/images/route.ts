import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { createPropertyImageSchema } from "@/lib/validations/property-image";
import {
  getImagesByPropertyId,
  createPropertyImage,
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
  }>;
}

/**
 * GET /api/properties/[id]/images
 * Public endpoint to retrieve all images for a property.
 * Ordered with cover image first, then by displayOrder.
 */
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const { id } = await context.params;
    const images = await getImagesByPropertyId(id);
    return successResponse(images);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/properties/[id]/images
 * Protected endpoint for OWNER (or ADMIN) to add image metadata to a property.
 * Atomically unsets any previous cover image if isCover is true.
 */
export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const { id } = await context.params;
    const user = await requireUser();

    if (user.role !== Role.OWNER && user.role !== Role.ADMIN) {
      throw new AuthException(
        403,
        "FORBIDDEN",
        "Only property owners or admins can add property images"
      );
    }

    const body = await request.json();
    const validatedData = createPropertyImageSchema.parse(body);

    const image = await createPropertyImage(
      id,
      user.id,
      user.role,
      validatedData
    );
    return successResponse(image, 201, "Property image added successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

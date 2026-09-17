import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  createPropertySchema,
  propertyQuerySchema,
} from "@/lib/validations/property";
import { createProperty, getProperties } from "@/lib/services/property.service";
import { successResponse, handleApiError } from "@/lib/api-response";
import { Role } from "@prisma/client";

/**
 * GET /api/properties
 * Public endpoint to list and search properties with filtering and pagination.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(
      request.nextUrl.searchParams.entries()
    );
    const validatedQuery = propertyQuerySchema.parse(searchParams);

    const result = await getProperties(validatedQuery);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/properties
 * Protected endpoint for OWNER role to create a new property listing.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(Role.OWNER);

    const body = await request.json();
    const validatedData = createPropertySchema.parse(body);

    const property = await createProperty(user.id, validatedData);

    return successResponse(
      property,
      201,
      "Property listing created successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

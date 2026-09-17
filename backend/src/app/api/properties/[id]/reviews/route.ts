import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  createReviewSchema,
  reviewQuerySchema,
} from "@/lib/validations/review";
import {
  createReview,
  getPropertyReviews,
} from "@/lib/services/review.service";
import { successResponse, handleApiError } from "@/lib/api-response";
import { Role } from "@prisma/client";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/properties/[id]/reviews
 * Public endpoint to list reviews for a specific property with rating aggregates and pagination.
 */
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const { id: propertyId } = await context.params;

    const searchParams = Object.fromEntries(
      request.nextUrl.searchParams.entries()
    );
    const validatedQuery = reviewQuerySchema.parse(searchParams);

    const result = await getPropertyReviews(propertyId, validatedQuery);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/properties/[id]/reviews
 * Protected endpoint for STUDENT role to submit a review for a property.
 * Enforces one-review-per-student-property and checks for verified stay.
 */
export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const { id: propertyId } = await context.params;
    const user = await requireRole(Role.STUDENT);

    const body = await request.json();
    const validatedData = createReviewSchema.parse(body);

    const review = await createReview(propertyId, user.id, validatedData);
    return successResponse(
      review,
      201,
      "Review submitted successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

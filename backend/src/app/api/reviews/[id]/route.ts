import { NextRequest } from "next/server";
import { requireUser, requireRole } from "@/lib/auth";
import { updateReviewSchema } from "@/lib/validations/review";
import {
  getReviewById,
  updateReview,
  deleteReview,
} from "@/lib/services/review.service";
import { successResponse, handleApiError } from "@/lib/api-response";
import { Role } from "@prisma/client";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/reviews/[id]
 * Protected endpoint to retrieve a single review.
 * Enforces IDOR protection: author (STUDENT), property owner (OWNER), or ADMIN.
 */
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const { id } = await context.params;
    const user = await requireUser();

    const review = await getReviewById(id, user);
    return successResponse(review);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/reviews/[id]
 * Protected endpoint for author (STUDENT) to update their review.
 * Forbids changing reviewer, property, or timestamps.
 */
export async function PATCH(request: NextRequest, context: RouteParams) {
  try {
    const { id } = await context.params;
    const user = await requireRole(Role.STUDENT);

    const body = await request.json();
    const validatedData = updateReviewSchema.parse(body);

    const updated = await updateReview(id, user.id, validatedData);
    return successResponse(updated, 200, "Review updated successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/reviews/[id]
 * Protected endpoint to delete a review.
 * Allowed for the author (STUDENT) or an ADMIN.
 */
export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    const { id } = await context.params;
    const user = await requireUser();

    const result = await deleteReview(id, user);
    return successResponse(result, 200, "Review deleted successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

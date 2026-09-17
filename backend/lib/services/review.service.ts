import { prisma } from "@/lib/prisma";
import { AuthException } from "@/lib/api-response";
import {
  CreateReviewInput,
  UpdateReviewInput,
  ReviewQueryInput,
} from "@/lib/validations/review";
import { BookingStatus, NotificationType, Role, User } from "@prisma/client";
import { createNotification } from "./notification.service";

/**
 * Calculates a 1-decimal-place composite overall rating from individual category ratings.
 */
function calculateOverallRating(
  cleanliness: number,
  location: number,
  value: number,
  owner?: number | null
): number {
  if (owner !== undefined && owner !== null) {
    return Number(((cleanliness + location + value + owner) / 4).toFixed(1));
  }
  return Number(((cleanliness + location + value) / 3).toFixed(1));
}

/**
 * Creates a review for a property by an authenticated student.
 * Verifies property existence, checks for duplicates, and marks verified stay.
 */
export async function createReview(
  propertyId: string,
  reviewerId: string,
  input: CreateReviewInput
) {
  // 1. Verify property exists
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });

  if (!property) {
    throw new AuthException(404, "NOT_FOUND", "Property not found");
  }

  // 2. Prevent duplicate reviews by the same student for the same property
  const existingReview = await prisma.review.findUnique({
    where: {
      propertyId_reviewerId: {
        propertyId,
        reviewerId,
      },
    },
  });

  if (existingReview) {
    throw new AuthException(
      409,
      "CONFLICT",
      "You have already submitted a review for this property"
    );
  }

  // 3. Require confirmed or completed booking to submit a review
  const eligibleBooking = await prisma.booking.findFirst({
    where: {
      studentId: reviewerId,
      propertyId,
      status: {
        in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED],
      },
    },
  });

  if (!eligibleBooking) {
    throw new AuthException(
      403,
      "REVIEW_REQUIRES_BOOKING",
      "You must have a confirmed or completed booking for this property to leave a review."
    );
  }

  const isVerifiedStay = true;

  // 4. Calculate composite overall rating
  const overallRating = calculateOverallRating(
    input.cleanlinessRating,
    input.locationRating,
    input.valueRating,
    input.ownerRating
  );

  // 5. Create review in database
  const review = await prisma.review.create({
    data: {
      propertyId,
      reviewerId,
      cleanlinessRating: input.cleanlinessRating,
      locationRating: input.locationRating,
      valueRating: input.valueRating,
      ownerRating: input.ownerRating ?? null,
      overallRating,
      comment: input.comment,
      isVerifiedStay,
    },
    include: {
      reviewer: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
    },
  });

  // Trigger owner notification
  createNotification({
    userId: property.ownerId,
    type: NotificationType.REVIEW_RECEIVED,
    title: "New Review Received",
    message: `Your property ${property.title} received a new ${review.overallRating}-star review.`,
    link: `/properties/${property.id}/reviews`,
  }).catch((err) => console.error("Failed to send review notification", err));

  return review;
}

/**
 * Retrieves paginated public reviews for a specific property.
 * Computes averageRating and reviewCount without updating trustScore automatically.
 */
export async function getPropertyReviews(
  propertyId: string,
  params: ReviewQueryInput
) {
  const { page = 1, limit = 20 } = params;
  const skip = (page - 1) * limit;

  // 1. Verify property exists
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true },
  });

  if (!property) {
    throw new AuthException(404, "NOT_FOUND", "Property not found");
  }

  // 2. Query count and rating aggregates in parallel
  const [total, aggregations, reviews] = await Promise.all([
    prisma.review.count({
      where: { propertyId },
    }),
    prisma.review.aggregate({
      where: { propertyId },
      _avg: {
        overallRating: true,
        cleanlinessRating: true,
        locationRating: true,
        valueRating: true,
        ownerRating: true,
      },
    }),
    prisma.review.findMany({
      where: { propertyId },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        reviewer: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    }),
  ]);

  const averageRating = aggregations._avg.overallRating
    ? Number(aggregations._avg.overallRating.toFixed(1))
    : 0;

  return {
    reviews,
    averageRating,
    reviewCount: total,
    ratingBreakdown: {
      cleanliness: aggregations._avg.cleanlinessRating
        ? Number(aggregations._avg.cleanlinessRating.toFixed(1))
        : 0,
      location: aggregations._avg.locationRating
        ? Number(aggregations._avg.locationRating.toFixed(1))
        : 0,
      value: aggregations._avg.valueRating
        ? Number(aggregations._avg.valueRating.toFixed(1))
        : 0,
      owner: aggregations._avg.ownerRating
        ? Number(aggregations._avg.ownerRating.toFixed(1))
        : null,
    },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Retrieves a single review by ID with strict IDOR prevention.
 */
export async function getReviewById(id: string, user: User) {
  const review = await prisma.review.findUnique({
    where: { id },
    include: {
      property: {
        select: {
          id: true,
          title: true,
          city: true,
          ownerId: true,
        },
      },
      reviewer: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
    },
  });

  if (!review) {
    throw new AuthException(404, "NOT_FOUND", "Review not found");
  }

  // IDOR check: STUDENT can only access their own review; ADMIN can access any;
  // OWNER can only access reviews on properties they own.
  const isAuthor = user.role === Role.STUDENT && review.reviewerId === user.id;
  const isPropertyOwner =
    user.role === Role.OWNER && review.property.ownerId === user.id;
  const isAdmin = user.role === Role.ADMIN;

  if (!isAuthor && !isPropertyOwner && !isAdmin) {
    throw new AuthException(
      403,
      "FORBIDDEN",
      "You do not have permission to access this review"
    );
  }

  return review;
}

/**
 * Updates a review. Strictly restricted to the original author (STUDENT).
 * Recalculates overallRating if individual sub-ratings are updated.
 */
export async function updateReview(
  id: string,
  reviewerId: string,
  input: UpdateReviewInput
) {
  const existingReview = await prisma.review.findUnique({
    where: { id },
  });

  if (!existingReview) {
    throw new AuthException(404, "NOT_FOUND", "Review not found");
  }

  if (existingReview.reviewerId !== reviewerId) {
    throw new AuthException(
      403,
      "FORBIDDEN",
      "You do not have permission to edit this review"
    );
  }

  // Recalculate overall rating if any score component changed
  const cleanliness =
    input.cleanlinessRating ?? existingReview.cleanlinessRating;
  const location = input.locationRating ?? existingReview.locationRating;
  const value = input.valueRating ?? existingReview.valueRating;
  const owner =
    input.ownerRating !== undefined
      ? input.ownerRating
      : existingReview.ownerRating;

  const overallRating = calculateOverallRating(
    cleanliness,
    location,
    value,
    owner
  );

  const updated = await prisma.review.update({
    where: { id },
    data: {
      ...(input.cleanlinessRating !== undefined
        ? { cleanlinessRating: input.cleanlinessRating }
        : {}),
      ...(input.locationRating !== undefined
        ? { locationRating: input.locationRating }
        : {}),
      ...(input.valueRating !== undefined
        ? { valueRating: input.valueRating }
        : {}),
      ...(input.ownerRating !== undefined
        ? { ownerRating: input.ownerRating }
        : {}),
      ...(input.comment !== undefined ? { comment: input.comment } : {}),
      overallRating,
    },
    include: {
      reviewer: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
    },
  });

  return updated;
}

/**
 * Deletes a review.
 * Allowed for the author (STUDENT) or an ADMIN.
 */
export async function deleteReview(id: string, user: User) {
  const existingReview = await prisma.review.findUnique({
    where: { id },
  });

  if (!existingReview) {
    throw new AuthException(404, "NOT_FOUND", "Review not found");
  }

  const isAuthor = existingReview.reviewerId === user.id;
  const isAdmin = user.role === Role.ADMIN;

  if (!isAuthor && !isAdmin) {
    throw new AuthException(
      403,
      "FORBIDDEN",
      "You do not have permission to delete this review"
    );
  }

  await prisma.review.delete({
    where: { id },
  });

  return { success: true, message: "Review deleted successfully" };
}

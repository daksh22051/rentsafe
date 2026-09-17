import { z } from "zod";

export const createReviewSchema = z.object({
  propertyId: z.string().uuid("Invalid property ID").optional(),
  cleanlinessRating: z
    .number()
    .int()
    .min(1, "Cleanliness rating must be at least 1")
    .max(5, "Cleanliness rating cannot exceed 5"),
  locationRating: z
    .number()
    .int()
    .min(1, "Location rating must be at least 1")
    .max(5, "Location rating cannot exceed 5"),
  valueRating: z
    .number()
    .int()
    .min(1, "Value rating must be at least 1")
    .max(5, "Value rating cannot exceed 5"),
  ownerRating: z
    .number()
    .int()
    .min(1)
    .max(5)
    .optional(),
  comment: z
    .string()
    .min(10, "Review comment must be at least 10 characters")
    .max(2000, "Review comment cannot exceed 2000 characters"),
});

export const updateReviewSchema = z
  .object({
    cleanlinessRating: z.number().int().min(1).max(5).optional(),
    locationRating: z.number().int().min(1).max(5).optional(),
    valueRating: z.number().int().min(1).max(5).optional(),
    ownerRating: z.number().int().min(1).max(5).optional(),
    comment: z.string().min(10).max(2000).optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one field must be provided to update" }
  );

export const reviewQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
export type ReviewQueryInput = z.infer<typeof reviewQuerySchema>;

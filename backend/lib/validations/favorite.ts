import { z } from "zod";

export const createFavoriteSchema = z
  .object({
    propertyId: z.string().uuid("Invalid property ID format"),
  })
  .strict();

export const favoriteQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const favoriteParamSchema = z.object({
  propertyId: z.string().uuid("Invalid property ID format"),
});

export type CreateFavoriteInput = z.infer<typeof createFavoriteSchema>;
export type FavoriteQueryInput = z.infer<typeof favoriteQuerySchema>;
export type FavoriteParamInput = z.infer<typeof favoriteParamSchema>;

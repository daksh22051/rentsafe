import { z } from "zod";

export const attachAmenitiesSchema = z
  .object({
    amenityIds: z
      .array(z.string().uuid("Each amenity ID must be a valid UUID"))
      .nonempty("At least one amenity ID must be provided or supply an empty array to clear"),
  })
  .strict();

export const syncAmenitiesSchema = z
  .object({
    amenityIds: z.array(z.string().uuid("Each amenity ID must be a valid UUID")),
  })
  .strict();

export const amenityQuerySchema = z.object({
  category: z.string().trim().optional(),
});

export type SyncAmenitiesInput = z.infer<typeof syncAmenitiesSchema>;
export type AmenityQueryInput = z.infer<typeof amenityQuerySchema>;

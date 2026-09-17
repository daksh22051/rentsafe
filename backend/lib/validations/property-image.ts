import { z } from "zod";

export const createPropertyImageSchema = z
  .object({
    url: z.string().url("Must be a valid image URL").max(2048),
    caption: z.string().trim().max(255).optional().nullable(),
    displayOrder: z.number().int().min(0).default(0),
    isCover: z.boolean().default(false),
  })
  .strict();

export const updatePropertyImageSchema = z
  .object({
    caption: z.string().trim().max(255).optional().nullable(),
    displayOrder: z.number().int().min(0).optional(),
    isCover: z.boolean().optional(),
  })
  .strict();

export const propertyImageParamSchema = z.object({
  id: z.string().uuid("Invalid property ID"),
  imageId: z.string().uuid("Invalid image ID"),
});

export type CreatePropertyImageInput = z.infer<typeof createPropertyImageSchema>;
export type UpdatePropertyImageInput = z.infer<typeof updatePropertyImageSchema>;

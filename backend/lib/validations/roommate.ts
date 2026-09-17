import { z } from "zod";

export const roommatePreferenceSchema = z
  .object({
    minBudget: z.number().nonnegative("Minimum budget cannot be negative").optional(),
    maxBudget: z.number().positive("Maximum budget must be greater than zero").optional(),
    preferredCity: z.string().trim().min(1).max(100).optional(),
    preferredLocations: z
      .array(z.string().trim().min(1).max(100))
      .max(20, "Cannot specify more than 20 preferred locations")
      .optional()
      .default([]),
    sleepSchedule: z.string().trim().max(50).optional(),
    foodPreference: z.string().trim().max(50).optional(),
    studyHabits: z.string().trim().max(50).optional(),
    lifestyle: z.string().trim().max(50).optional(),
    smokingAllowed: z.boolean().default(false),
    drinkingAllowed: z.boolean().default(false),
    petsAllowed: z.boolean().default(false),
    genderPreference: z.string().trim().max(50).optional(),
    bio: z.string().trim().max(1000, "Bio cannot exceed 1000 characters").optional(),
    isActive: z.boolean().default(true),
  })
  .strict()
  .refine(
    (data) => {
      if (
        data.minBudget !== undefined &&
        data.maxBudget !== undefined &&
        data.minBudget > data.maxBudget
      ) {
        return false;
      }
      return true;
    },
    {
      message: "Minimum budget cannot be greater than maximum budget",
      path: ["minBudget"],
    }
  );

export const roommateMatchesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type RoommatePreferenceInput = z.infer<typeof roommatePreferenceSchema>;
export type RoommateMatchesQueryInput = z.infer<typeof roommateMatchesQuerySchema>;

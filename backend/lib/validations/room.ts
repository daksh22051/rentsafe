import { z } from "zod";

export const roomTypeEnum = z.enum([
  "SINGLE",
  "DOUBLE_SHARING",
  "TRIPLE_SHARING",
  "FOUR_SHARING",
  "HALL_OR_SHARED",
]);

export const createRoomSchema = z
  .object({
    roomNumber: z.string().trim().max(50).optional().nullable(),
    roomType: roomTypeEnum,
    rent: z.number().positive("Rent must be positive"),
    securityDeposit: z
      .number()
      .nonnegative("Security deposit must be 0 or more")
      .optional()
      .nullable(),
    capacity: z
      .number()
      .int()
      .min(1, "Capacity must be at least 1")
      .default(1),
    currentOccupancy: z
      .number()
      .int()
      .min(0, "Current occupancy cannot be negative")
      .default(0),
    isAvailable: z.boolean().default(true),
    hasAttachedBathroom: z.boolean().default(false),
    hasBalcony: z.boolean().default(false),
    hasAc: z.boolean().default(false),
    description: z.string().trim().max(1000).optional().nullable(),
  })
  .strict()
  .refine(
    (data) => data.currentOccupancy <= data.capacity,
    {
      message: "Current occupancy cannot exceed room capacity",
      path: ["currentOccupancy"],
    }
  );

export const updateRoomSchema = z
  .object({
    roomNumber: z.string().trim().max(50).optional().nullable(),
    roomType: roomTypeEnum.optional(),
    rent: z.number().positive("Rent must be positive").optional(),
    securityDeposit: z
      .number()
      .nonnegative("Security deposit must be 0 or more")
      .optional()
      .nullable(),
    capacity: z
      .number()
      .int()
      .min(1, "Capacity must be at least 1")
      .optional(),
    currentOccupancy: z
      .number()
      .int()
      .min(0, "Current occupancy cannot be negative")
      .optional(),
    isAvailable: z.boolean().optional(),
    hasAttachedBathroom: z.boolean().optional(),
    hasBalcony: z.boolean().optional(),
    hasAc: z.boolean().optional(),
    description: z.string().trim().max(1000).optional().nullable(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.capacity !== undefined && data.currentOccupancy !== undefined) {
        return data.currentOccupancy <= data.capacity;
      }
      return true;
    },
    {
      message: "Current occupancy cannot exceed room capacity",
      path: ["currentOccupancy"],
    }
  );

export const roomParamSchema = z.object({
  id: z.string().uuid("Invalid property ID"),
  roomId: z.string().uuid("Invalid room ID"),
});

export const roomQuerySchema = z.object({
  isAvailable: z
    .preprocess((val) => {
      if (val === "true" || val === true) return true;
      if (val === "false" || val === false) return false;
      return val;
    }, z.boolean().optional()),
  roomType: roomTypeEnum.optional(),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type RoomQueryInput = z.infer<typeof roomQuerySchema>;

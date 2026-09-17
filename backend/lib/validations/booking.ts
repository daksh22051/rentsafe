import { z } from "zod";

export const bookingStatusEnum = z.enum([
  "PENDING",
  "CONFIRMED",
  "REJECTED",
  "CANCELLED",
  "COMPLETED",
]);

export const createBookingSchema = z
  .object({
    propertyId: z.string().uuid("Invalid property ID"),
    roomId: z.string().uuid("Invalid room ID").optional(),
    moveInDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid move-in date format (ISO-8601 expected)",
      }),
    moveOutDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid move-out date format (ISO-8601 expected)",
      })
      .optional(),
    specialRequests: z.string().max(1000).optional(),
  })
  .refine(
    (data) => {
      if (data.moveOutDate) {
        return new Date(data.moveOutDate) > new Date(data.moveInDate);
      }
      return true;
    },
    {
      message: "Move-out date must be after move-in date",
      path: ["moveOutDate"],
    }
  );

export const updateBookingStatusSchema = z.object({
  status: bookingStatusEnum,
  notes: z.string().max(1000).optional(),
});

export const bookingQuerySchema = z.object({
  status: bookingStatusEnum.optional(),
  propertyId: z.string().uuid("Invalid property ID").optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>;
export type BookingQueryInput = z.infer<typeof bookingQuerySchema>;

import { z } from "zod";

export const paymentBookingParamSchema = z.object({
  id: z.string().uuid("Invalid booking ID format"),
});

export const initiatePaymentSchema = z
  .object({
    paymentMethod: z
      .enum(["CARD", "UPI", "NETBANKING", "WALLET", "CASH"])
      .optional()
      .default("UPI"),
    notes: z.string().trim().max(500, "Notes cannot exceed 500 characters").optional(),
  })
  .strict();

export type PaymentBookingParamInput = z.infer<typeof paymentBookingParamSchema>;
export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>;

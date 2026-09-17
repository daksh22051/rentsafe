import { z } from "zod";

export const verificationStatusEnum = z.enum([
  "PENDING",
  "ADMIN_REVIEW",
  "APPROVED",
  "REJECTED",
  "VERIFIED",
]);

export const submitVerificationSchema = z
  .object({
    propertyId: z.string().uuid("Invalid property ID format"),
    documentType: z
      .string()
      .trim()
      .min(2, "Document type must be at least 2 characters")
      .max(100, "Document type cannot exceed 100 characters"),
    documentUrl: z.string().url("Document URL must be a valid URL").optional(),
    submittedNotes: z
      .string()
      .trim()
      .max(1000, "Notes cannot exceed 1000 characters")
      .optional(),
  })
  .strict();

export const adminUpdateVerificationSchema = z
  .object({
    status: verificationStatusEnum,
    rejectionReason: z
      .string()
      .trim()
      .max(1000, "Rejection reason cannot exceed 1000 characters")
      .optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (
        data.status === "REJECTED" &&
        (!data.rejectionReason || data.rejectionReason.length < 5)
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        "A rejection reason of at least 5 characters is required when rejecting verification",
      path: ["rejectionReason"],
    }
  );

export const verificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: verificationStatusEnum.optional(),
  propertyId: z.string().uuid("Invalid property ID format").optional(),
});

export const verificationParamSchema = z.object({
  id: z.string().uuid("Invalid verification ID format"),
});

export type SubmitVerificationInput = z.infer<typeof submitVerificationSchema>;
export type AdminUpdateVerificationInput = z.infer<typeof adminUpdateVerificationSchema>;
export type VerificationQueryInput = z.infer<typeof verificationQuerySchema>;
export type VerificationParamInput = z.infer<typeof verificationParamSchema>;

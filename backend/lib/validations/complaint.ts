import { z } from "zod";

export const complaintTypeEnum = z.enum([
  "NOISE_DISTURBANCE",
  "MAINTENANCE_ISSUE",
  "SECURITY_CONCERN",
  "FALSE_LISTING",
  "OVERCHARGING",
  "UNHYGIENIC_CONDITIONS",
  "OTHER",
]);

export const complaintStatusEnum = z.enum([
  "SUBMITTED",
  "UNDER_REVIEW",
  "IN_PROGRESS",
  "RESOLVED",
]);

export const createComplaintSchema = z
  .object({
    propertyId: z.string().uuid("Invalid property ID format"),
    complaintType: complaintTypeEnum,
    description: z
      .string()
      .trim()
      .min(15, "Description must be at least 15 characters long")
      .max(5000, "Description cannot exceed 5000 characters"),
    evidenceUrls: z
      .array(z.string().url("Each evidence URL must be a valid URL"))
      .max(10, "Cannot upload more than 10 evidence items")
      .optional()
      .default([]),
  })
  .strict();

export const updateComplaintStatusSchema = z
  .object({
    status: complaintStatusEnum,
    adminNotes: z
      .string()
      .trim()
      .max(2000, "Notes cannot exceed 2000 characters")
      .optional(),
  })
  .strict();

export const complaintQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: complaintStatusEnum.optional(),
  complaintType: complaintTypeEnum.optional(),
  propertyId: z.string().uuid("Invalid property ID format").optional(),
});

export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;
export type UpdateComplaintStatusInput = z.infer<typeof updateComplaintStatusSchema>;
export type ComplaintQueryInput = z.infer<typeof complaintQuerySchema>;

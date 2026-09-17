import { z } from "zod";
import { roleEnum } from "./auth";
import { propertyTypeEnum, propertyVerificationStatusEnum } from "./property";
import { bookingStatusEnum } from "./booking";

export const adminUserQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: roleEnum.optional(),
  search: z.string().trim().max(100).optional(),
});

export const adminPropertyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  city: z.string().trim().max(100).optional(),
  verificationStatus: propertyVerificationStatusEnum.optional(),
  propertyType: propertyTypeEnum.optional(),
  isAvailable: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  search: z.string().trim().max(100).optional(),
});

export const adminBookingQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: bookingStatusEnum.optional(),
  propertyId: z.string().uuid("Invalid property ID").optional(),
  studentId: z.string().uuid("Invalid student ID").optional(),
  ownerId: z.string().uuid("Invalid owner ID").optional(),
});

export const updateUserRoleSchema = z
  .object({
    role: roleEnum,
  })
  .strict();

export const adminParamSchema = z.object({
  id: z.string().uuid("Invalid ID format"),
});

export type AdminUserQueryInput = z.infer<typeof adminUserQuerySchema>;
export type AdminPropertyQueryInput = z.infer<typeof adminPropertyQuerySchema>;
export type AdminBookingQueryInput = z.infer<typeof adminBookingQuerySchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type AdminParamInput = z.infer<typeof adminParamSchema>;

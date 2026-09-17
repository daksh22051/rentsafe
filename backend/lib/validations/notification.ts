import { z } from "zod";

export const notificationTypeEnum = z.enum([
  "BOOKING_UPDATE",
  "VERIFICATION_UPDATE",
  "COMPLAINT_UPDATE",
  "REVIEW_RECEIVED",
  "ROOMMATE_MATCH",
  "SYSTEM_ALERT",
]);

export const notificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  isRead: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
  type: notificationTypeEnum.optional(),
});

export const updateNotificationSchema = z
  .object({
    isRead: z.boolean().default(true),
  })
  .strict();

export const notificationParamSchema = z.object({
  id: z.string().uuid("Invalid notification ID format"),
});

export type NotificationQueryInput = z.infer<typeof notificationQuerySchema>;
export type UpdateNotificationInput = z.infer<typeof updateNotificationSchema>;
export type NotificationParamInput = z.infer<typeof notificationParamSchema>;

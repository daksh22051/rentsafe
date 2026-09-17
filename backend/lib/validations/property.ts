import { z } from "zod";
import { roomTypeEnum } from "./room";

export const propertyTypeEnum = z.enum([
  "APARTMENT",
  "HOSTEL",
  "PG",
  "FLAT",
  "STUDIO",
  "HOUSE",
]);

export const furnishedStatusEnum = z.enum([
  "FULLY_FURNISHED",
  "SEMI_FURNISHED",
  "UNFURNISHED",
]);

export const foodAvailabilityEnum = z.enum([
  "INCLUDED",
  "AVAILABLE_OPTIONAL",
  "NOT_AVAILABLE",
  "SELF_COOKING_ALLOWED",
]);

export const createPropertySchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  propertyType: propertyTypeEnum,
  address: z.string().min(5, "Address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  pincode: z.string().min(4, "Valid pincode is required"),
  landmark: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  rent: z.number().positive("Rent must be positive"),
  securityDeposit: z.number().nonnegative("Security deposit must be 0 or more"),
  isAvailable: z.boolean().default(true),
  availableFrom: z.string().datetime().optional(),
  foodInfo: foodAvailabilityEnum.default("NOT_AVAILABLE"),
  foodDescription: z.string().optional(),
  hasWifi: z.boolean().default(false),
  wifiSpeedMbps: z.number().int().positive().optional(),
  furnishedStatus: furnishedStatusEnum.default("SEMI_FURNISHED"),
  rules: z.string().optional(),
  totalRooms: z.number().int().positive().default(1),
  totalBeds: z.number().int().positive().optional(),
  noticePeriodDays: z.number().int().nonnegative().optional(),
  lockInPeriodMonths: z.number().int().nonnegative().optional(),
  amenityIds: z.array(z.string().uuid()).optional(),
});

export const updatePropertySchema = createPropertySchema.partial();

export const propertyVerificationStatusEnum = z.enum([
  "UNVERIFIED",
  "PENDING",
  "VERIFIED",
  "REJECTED",
]);

const booleanQuery = z
  .preprocess((val) => {
    if (val === "true" || val === true) return true;
    if (val === "false" || val === false) return false;
    return val;
  }, z.boolean().optional());

export const propertyQuerySchema = z.object({
  city: z.string().optional(),
  minRent: z.coerce.number().positive().optional(),
  maxRent: z.coerce.number().positive().optional(),
  propertyType: propertyTypeEnum.optional(),
  furnishedStatus: furnishedStatusEnum.optional(),
  foodInfo: foodAvailabilityEnum.optional(),
  hasWifi: booleanQuery,
  verificationStatus: propertyVerificationStatusEnum.optional(),
  isAvailable: booleanQuery.default(true),
  roomType: roomTypeEnum.optional(),
  amenityId: z.string().uuid().optional(),
  roomAvailable: booleanQuery,
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type PropertyQueryInput = z.infer<typeof propertyQuerySchema>;

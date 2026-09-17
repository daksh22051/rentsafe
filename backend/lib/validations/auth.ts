import { z } from "zod";

export const roleEnum = z.enum(["STUDENT", "OWNER", "ADMIN"]);

export const signUpRoleEnum = z.enum(["STUDENT", "OWNER"]);

export const signUpSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
    name: z.string().min(2, "Name must be at least 2 characters long"),
    role: signUpRoleEnum.default("STUDENT"),
    phone: z.string().optional(),
  })
  .strict();

export const signInSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
  })
  .strict();

export const updateProfileSchema = z
  .object({
    name: z.string().min(2).optional(),
    phone: z.string().optional(),
    avatarUrl: z.string().url("Must be a valid URL").optional(),
  })
  .strict();

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

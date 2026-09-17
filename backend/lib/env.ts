import { z } from "zod";

/**
 * Schema for server-only environment variables.
 * NEVER expose these to the browser or prefix with NEXT_PUBLIC_.
 */
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().min(1, "DIRECT_URL is required"),
  ALLOWED_ORIGIN: z.string().optional(),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

/**
 * Schema for public client-accessible environment variables.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
});

export interface EnvValidationResult {
  isValid: boolean;
  missingOrInvalid: string[];
}

/**
 * Validates environment variables safely.
 * Reports missing or invalid configuration names without exposing secret values.
 */
export function validateEnv(): EnvValidationResult {
  const missingOrInvalid: string[] = [];

  const serverResult = serverEnvSchema.safeParse(process.env);
  if (!serverResult.success) {
    for (const issue of serverResult.error.issues) {
      missingOrInvalid.push(String(issue.path[0]));
    }
  }

  const publicResult = publicEnvSchema.safeParse(process.env);
  if (!publicResult.success) {
    for (const issue of publicResult.error.issues) {
      missingOrInvalid.push(String(issue.path[0]));
    }
  }

  return {
    isValid: missingOrInvalid.length === 0,
    missingOrInvalid: Array.from(new Set(missingOrInvalid)),
  };
}

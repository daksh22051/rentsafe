import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signUpSchema } from "@/lib/validations";
import { syncUserFromSupabase, sanitizeUser } from "@/lib/auth";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { Role } from "@prisma/client";

/**
 * POST /api/auth/signup
 * Registers a new user via Supabase Auth and synchronizes the Prisma User record.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = signUpSchema.parse(body);

    // Defense-in-depth: Reject any attempt to self-assign ADMIN role
    if ((validatedData.role as string) === Role.ADMIN) {
      return errorResponse(
        403,
        "FORBIDDEN",
        "Self-assigning administrator privileges is strictly forbidden"
      );
    }

    const supabase = await createClient();

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: validatedData.email,
      password: validatedData.password,
      options: {
        data: {
          name: validatedData.name,
          role: validatedData.role,
          phone: validatedData.phone,
        },
      },
    });

    if (authError) {
      // 409 Conflict if user already registered or error message indicates existing user
      if (
        authError.message.toLowerCase().includes("already registered") ||
        authError.status === 422
      ) {
        return errorResponse(
          409,
          "CONFLICT",
          "A user with this email already exists"
        );
      }

      return errorResponse(400, "BAD_REQUEST", authError.message);
    }

    if (!authData.user) {
      return errorResponse(
        500,
        "INTERNAL_SERVER_ERROR",
        "Failed to create user account"
      );
    }

    // Synchronize user in Prisma with the requested role
    const newUser = await syncUserFromSupabase(
      authData.user,
      validatedData.role as Role
    );

    return successResponse(
      sanitizeUser(newUser),
      201,
      "Account created successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

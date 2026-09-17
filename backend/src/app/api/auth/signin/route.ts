import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signInSchema } from "@/lib/validations";
import { syncUserFromSupabase, sanitizeUser } from "@/lib/auth";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

/**
 * POST /api/auth/signin
 * Authenticates user credentials via Supabase Auth and establishes a cookie session.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = signInSchema.parse(body);

    const supabase = await createClient();

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: validatedData.email,
        password: validatedData.password,
      });

    if (authError || !authData.user) {
      return errorResponse(
        401,
        "UNAUTHORIZED",
        "Invalid email or password"
      );
    }

    const user = await syncUserFromSupabase(authData.user);

    return successResponse(
      sanitizeUser(user),
      200,
      "Signed in successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

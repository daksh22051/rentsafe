import { createClient } from "@/lib/supabase/server";
import { successResponse, handleApiError } from "@/lib/api-response";

/**
 * POST /api/auth/signout
 * Clears the user's Supabase authentication session and cookies.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();

    return successResponse(null, 200, "Signed out successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { roommateMatchesQuerySchema } from "@/lib/validations/roommate";
import { getRoommateMatches } from "@/lib/services/roommate.service";
import { successResponse, handleApiError } from "@/lib/api-response";
import { Role } from "@prisma/client";

/**
 * GET /api/roommate-preferences/matches
 * Returns compatible roommate candidates for the authenticated student
 * ranked by deterministic compatibility scoring.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(Role.STUDENT);

    const searchParams = Object.fromEntries(
      request.nextUrl.searchParams.entries()
    );
    const validatedQuery = roommateMatchesQuerySchema.parse(searchParams);

    const result = await getRoommateMatches(user.id, validatedQuery);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

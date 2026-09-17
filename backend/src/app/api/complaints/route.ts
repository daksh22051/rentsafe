import { NextRequest } from "next/server";
import { requireUser, requireRole } from "@/lib/auth";
import {
  createComplaintSchema,
  complaintQuerySchema,
} from "@/lib/validations/complaint";
import {
  createComplaint,
  getComplaints,
} from "@/lib/services/complaint.service";
import { successResponse, handleApiError } from "@/lib/api-response";
import { Role } from "@prisma/client";

/**
 * GET /api/complaints
 * Returns paginated complaints scoped to the authenticated user's role:
 * - STUDENT: sees only their own complaints
 * - OWNER: sees complaints for properties they own
 * - ADMIN: sees all complaints
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();

    const searchParams = Object.fromEntries(
      request.nextUrl.searchParams.entries()
    );
    const validatedQuery = complaintQuerySchema.parse(searchParams);

    const result = await getComplaints(user, validatedQuery);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/complaints
 * Creates a new complaint for a property.
 * Restricted to authenticated STUDENT users with a verified stay (CONFIRMED or COMPLETED booking).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(Role.STUDENT);

    const body = await request.json();
    const validatedData = createComplaintSchema.parse(body);

    const complaint = await createComplaint(user.id, validatedData);
    return successResponse(
      complaint,
      201,
      "Complaint submitted successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

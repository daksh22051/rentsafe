import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { updateComplaintStatusSchema } from "@/lib/validations/complaint";
import {
  getComplaintById,
  updateComplaintStatus,
  closeComplaint,
} from "@/lib/services/complaint.service";
import { successResponse, handleApiError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/complaints/[id]
 * Retrieves a single complaint by ID with IDOR protection:
 * - STUDENT: can only view their own complaint
 * - OWNER: can only view complaints for their properties
 * - ADMIN: can view any complaint
 */
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const user = await requireUser();
    const { id } = await context.params;

    const complaint = await getComplaintById(id, user);
    return successResponse(complaint);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/complaints/[id]
 * Updates complaint status and notes.
 * Restricted to OWNER (for their properties) and ADMIN.
 */
export async function PATCH(request: NextRequest, context: RouteParams) {
  try {
    const user = await requireUser();
    const { id } = await context.params;

    const body = await request.json();
    const validatedData = updateComplaintStatusSchema.parse(body);

    const updated = await updateComplaintStatus(id, user, validatedData);
    return successResponse(
      updated,
      200,
      "Complaint status updated successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/complaints/[id]
 * Closes a complaint via status resolution rather than hard deletion,
 * preserving audit records.
 * Permitted only for the complaint creator or an ADMIN.
 */
export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    const user = await requireUser();
    const { id } = await context.params;

    const closed = await closeComplaint(id, user);
    return successResponse(
      closed,
      200,
      "Complaint closed successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

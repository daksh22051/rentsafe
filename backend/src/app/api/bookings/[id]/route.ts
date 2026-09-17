import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { updateBookingStatusSchema } from "@/lib/validations/booking";
import {
  getBookingById,
  updateBookingStatus,
  cancelBooking,
} from "@/lib/services/booking.service";
import { successResponse, handleApiError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/bookings/[id]
 * Retrieves a single booking by ID.
 * Access restricted to the student who booked, the owner who owns the property, or an admin.
 */
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const { id } = await context.params;
    const user = await requireUser();

    const booking = await getBookingById(id, user);
    return successResponse(booking);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/bookings/[id]
 * Updates booking status according to role state machine:
 * - OWNER: can CONFIRM, REJECT, or CANCEL pending bookings.
 * - STUDENT: can only CANCEL their own pending/confirmed bookings.
 * - ADMIN: full transition authority.
 */
export async function PATCH(request: NextRequest, context: RouteParams) {
  try {
    const { id } = await context.params;
    const user = await requireUser();

    const body = await request.json();
    const validatedData = updateBookingStatusSchema.parse(body);

    const updated = await updateBookingStatus(id, user, validatedData);
    return successResponse(
      updated,
      200,
      "Booking status updated successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/bookings/[id]
 * Soft cancellation for bookings (preserves historical audit record).
 */
export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    const { id } = await context.params;
    const user = await requireUser();

    const cancelled = await cancelBooking(id, user);
    return successResponse(
      cancelled,
      200,
      "Booking cancelled successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest } from "next/server";
import { requireUser, requireRole } from "@/lib/auth";
import {
  createBookingSchema,
  bookingQuerySchema,
} from "@/lib/validations/booking";
import { createBooking, getBookings } from "@/lib/services/booking.service";
import { successResponse, handleApiError } from "@/lib/api-response";
import { Role } from "@prisma/client";

/**
 * GET /api/bookings
 * Returns bookings relevant to the authenticated user:
 * - STUDENT: sees their own reservations.
 * - OWNER: sees booking requests for properties they own.
 * - ADMIN: sees all bookings.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();

    const searchParams = Object.fromEntries(
      request.nextUrl.searchParams.entries()
    );
    const validatedQuery = bookingQuerySchema.parse(searchParams);

    const result = await getBookings(user, validatedQuery);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/bookings
 * Protected endpoint for STUDENT role to request a rental booking.
 * Injects student ID strictly from authenticated session.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(Role.STUDENT);

    const body = await request.json();
    const validatedData = createBookingSchema.parse(body);

    const booking = await createBooking(user.id, validatedData);

    return successResponse(
      booking,
      201,
      "Booking request submitted successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

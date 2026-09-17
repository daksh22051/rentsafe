import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  paymentBookingParamSchema,
  initiatePaymentSchema,
} from "@/lib/validations/payment";
import {
  calculateBookingAmount,
  createPaymentOrder,
} from "@/lib/services/payment.service";
import { successResponse, handleApiError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/bookings/[id]/payment
 * Retrieves authoritative financial summary for a booking.
 * Enforces ownership and status restrictions.
 */
export async function GET(_request: NextRequest, context: RouteParams) {
  void _request;
  try {
    const user = await requireUser();
    const { id } = await context.params;

    paymentBookingParamSchema.parse({ id });

    const result = await calculateBookingAmount(id, user);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/bookings/[id]/payment
 * Initiates payment order creation for a confirmed booking.
 * Returns 501 when no external payment gateway provider is configured.
 */
export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const user = await requireUser();
    const { id } = await context.params;

    paymentBookingParamSchema.parse({ id });

    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const validatedData = initiatePaymentSchema.parse(body);

    const result = await createPaymentOrder(id, user, validatedData);
    return successResponse(result, 201, "Payment order created successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

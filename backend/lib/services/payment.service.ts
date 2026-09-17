import { prisma } from "@/lib/prisma";
import { AuthException } from "@/lib/api-response";
import { InitiatePaymentInput } from "@/lib/validations/payment";
import { BookingStatus, Role, User } from "@prisma/client";

export interface PaymentOrderDetails {
  bookingId: string;
  bookingStatus: BookingStatus;
  currency: string;
  financialSummary: {
    rentAmount: number;
    depositAmount: number;
    totalAmount: number;
  };
  property: {
    id: string;
    title: string;
    address: string;
    city: string;
  };
  room: {
    id: string;
    roomNumber: string | null;
    roomType: string;
  } | null;
  paymentGatewayAvailable: boolean;
  message: string;
}

export interface PaymentOrder {
  orderId: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: string;
}

export interface PaymentVerificationPayload {
  orderId: string;
  paymentId: string;
  signature: string;
}

/**
 * Calculates authoritative financial breakdown for a booking server-side.
 * Enforces ownership and booking status restrictions.
 */
export async function calculateBookingAmount(
  bookingId: string,
  user: User
): Promise<PaymentOrderDetails> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      property: {
        select: {
          id: true,
          title: true,
          address: true,
          city: true,
          ownerId: true,
        },
      },
      room: {
        select: {
          id: true,
          roomNumber: true,
          roomType: true,
        },
      },
    },
  });

  if (!booking) {
    throw new AuthException(404, "BOOKING_NOT_FOUND", "Booking not found");
  }

  // IDOR protection
  if (user.role === Role.STUDENT && booking.studentId !== user.id) {
    throw new AuthException(
      403,
      "FORBIDDEN",
      "You can only access payment details for your own bookings"
    );
  }

  if (user.role === Role.OWNER && booking.property.ownerId !== user.id) {
    throw new AuthException(
      403,
      "FORBIDDEN",
      "You can only view payment details for bookings on properties you own"
    );
  }

  // Booking state check
  if (booking.status === BookingStatus.CANCELLED) {
    throw new AuthException(
      400,
      "PAYMENT_NOT_ALLOWED",
      "Cannot process payment for a cancelled booking"
    );
  }

  if (booking.status === BookingStatus.REJECTED) {
    throw new AuthException(
      400,
      "PAYMENT_NOT_ALLOWED",
      "Cannot process payment for a rejected booking"
    );
  }

  if (booking.status === BookingStatus.COMPLETED) {
    throw new AuthException(
      400,
      "PAYMENT_ALREADY_COMPLETED",
      "Booking is already marked as completed"
    );
  }

  if (booking.status === BookingStatus.PENDING) {
    throw new AuthException(
      400,
      "PAYMENT_NOT_ALLOWED",
      "Payment can only be initiated after the owner confirms the booking request"
    );
  }

  const isGatewayConfigured = Boolean(
    process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
  );

  return {
    bookingId: booking.id,
    bookingStatus: booking.status,
    currency: "INR",
    financialSummary: {
      rentAmount: Number(booking.rentAmount),
      depositAmount: Number(booking.depositAmount),
      totalAmount: Number(booking.totalAmount),
    },
    property: {
      id: booking.property.id,
      title: booking.property.title,
      address: booking.property.address,
      city: booking.property.city,
    },
    room: booking.room,
    paymentGatewayAvailable: isGatewayConfigured,
    message: isGatewayConfigured
      ? "Payment gateway is ready for checkout"
      : "Payment gateway integration is pending configuration. Online transactions are temporarily disabled.",
  };
}

/**
 * Initiates a payment order for a confirmed booking.
 * Calculates amount strictly server-side from database records.
 * Returns 501 when no external gateway provider is configured.
 */
export async function createPaymentOrder(
  bookingId: string,
  user: User,
  _input: InitiatePaymentInput
) {
  void _input;

  // 1. Role verification: Only students pay for bookings
  if (user.role !== Role.STUDENT) {
    throw new AuthException(
      403,
      "FORBIDDEN",
      "Only students can initiate payments for bookings"
    );
  }

  // 2. Fetch booking and verify ownership
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      property: {
        select: {
          id: true,
          title: true,
          ownerId: true,
        },
      },
    },
  });

  if (!booking) {
    throw new AuthException(404, "BOOKING_NOT_FOUND", "Booking not found");
  }

  if (booking.studentId !== user.id) {
    throw new AuthException(
      403,
      "FORBIDDEN",
      "You can only initiate payment for your own booking"
    );
  }

  // 3. Status restriction: Payment is only allowed for CONFIRMED bookings
  if (booking.status === BookingStatus.PENDING) {
    throw new AuthException(
      400,
      "PAYMENT_NOT_ALLOWED",
      "Booking must be approved and confirmed by the owner before payment can be initiated"
    );
  }

  if (booking.status !== BookingStatus.CONFIRMED) {
    throw new AuthException(
      400,
      "PAYMENT_NOT_ALLOWED",
      `Payment is not allowed for booking status: ${booking.status}`
    );
  }

  // 4. Check external gateway credentials
  const isGatewayConfigured = Boolean(
    process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
  );

  if (!isGatewayConfigured) {
    throw new AuthException(
      501,
      "PAYMENT_PROVIDER_NOT_CONFIGURED",
      "Online payment gateway is not currently configured. Please contact the property owner for direct payment arrangement."
    );
  }

  // When gateway is configured in the future, provider SDK call will happen here using booking.totalAmount
  return {
    orderId: `order_${booking.id.replace(/-/g, "")}`,
    bookingId: booking.id,
    amount: Number(booking.totalAmount),
    currency: "INR",
    status: "CREATED",
  };
}

import { prisma } from "@/lib/prisma";
import { AuthException } from "@/lib/api-response";
import {
  CreateBookingInput,
  UpdateBookingStatusInput,
  BookingQueryInput,
} from "@/lib/validations/booking";
import { BookingStatus, NotificationType, Prisma, Role, User } from "@prisma/client";
import { createNotification } from "./notification.service";

/**
 * Creates a new booking request for a student.
 * Verifies property/room availability, prevents duplicate active bookings,
 * and sets the initial status to PENDING.
 */
export async function createBooking(studentId: string, input: CreateBookingInput) {
  const { propertyId, roomId, moveInDate, moveOutDate, specialRequests } = input;

  // 1. Verify property exists
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: {
      rooms: true,
    },
  });

  if (!property) {
    throw new AuthException(404, "NOT_FOUND", "Property not found");
  }

  // 2. Verify property is available
  if (!property.isAvailable) {
    throw new AuthException(
      400,
      "BAD_REQUEST",
      "This property is currently not available for new bookings"
    );
  }

  // 3. Prevent owner from booking their own property
  if (property.ownerId === studentId) {
    throw new AuthException(
      400,
      "BAD_REQUEST",
      "You cannot book your own property"
    );
  }

  // 4. If a specific room is selected, verify room validity and availability
  let rentAmount = property.rent;
  let depositAmount = property.securityDeposit;

  if (roomId) {
    const room = property.rooms.find((r) => r.id === roomId);
    if (!room) {
      throw new AuthException(
        404,
        "NOT_FOUND",
        "Selected room does not exist in this property"
      );
    }
    if (!room.isAvailable) {
      throw new AuthException(
        400,
        "BAD_REQUEST",
        "Selected room is currently not available"
      );
    }
    rentAmount = room.rent;
    depositAmount = room.securityDeposit ?? property.securityDeposit;
  }

  // Calculate total amount (initial deposit + first month's rent)
  const totalAmount = new Prisma.Decimal(rentAmount).add(
    new Prisma.Decimal(depositAmount)
  );

  // 5. Prevent duplicate conflicting booking requests from the same student
  const existingActiveBooking = await prisma.booking.findFirst({
    where: {
      studentId,
      propertyId,
      ...(roomId ? { roomId } : {}),
      status: {
        in: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
      },
    },
  });

  if (existingActiveBooking) {
    throw new AuthException(
      409,
      "CONFLICT",
      "You already have a pending or confirmed booking request for this property"
    );
  }

  // 6. Create booking with server-calculated amounts and safe PENDING status
  const booking = await prisma.booking.create({
    data: {
      studentId,
      propertyId,
      roomId: roomId ?? null,
      status: BookingStatus.PENDING,
      moveInDate: new Date(moveInDate),
      moveOutDate: moveOutDate ? new Date(moveOutDate) : null,
      rentAmount,
      depositAmount,
      totalAmount,
      specialRequests: specialRequests ?? null,
    },
    include: {
      property: {
        select: {
          id: true,
          title: true,
          address: true,
          city: true,
          propertyType: true,
          images: {
            take: 1,
            orderBy: { displayOrder: "asc" },
            select: { url: true },
          },
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      },
      room: {
        select: {
          id: true,
          roomNumber: true,
          roomType: true,
        },
      },
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
  });

  // Trigger owner notification
  createNotification({
    userId: property.ownerId,
    type: NotificationType.BOOKING_UPDATE,
    title: "New Booking Request",
    message: `A new booking request has been submitted for ${property.title}.`,
    link: `/bookings/${booking.id}`,
  }).catch((err) => console.error("Failed to send booking notification", err));

  return booking;
}

/**
 * Retrieves bookings relevant to the authenticated user based on role:
 * - STUDENT: their own booking requests.
 * - OWNER: bookings made on properties they own.
 * - ADMIN: all bookings (or filtered by propertyId/status).
 */
export async function getBookings(user: User, params: BookingQueryInput) {
  const { status, propertyId, page = 1, limit = 20 } = params;
  const skip = (page - 1) * limit;

  // Build role-isolated filter
  const where: Prisma.BookingWhereInput = {
    ...(status ? { status } : {}),
    ...(propertyId ? { propertyId } : {}),
    ...(user.role === Role.STUDENT ? { studentId: user.id } : {}),
    ...(user.role === Role.OWNER ? { property: { ownerId: user.id } } : {}),
  };

  const [total, bookings] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            address: true,
            city: true,
            propertyType: true,
            images: {
              take: 1,
              orderBy: { displayOrder: "asc" },
              select: { url: true },
            },
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
        room: {
          select: {
            id: true,
            roomNumber: true,
            roomType: true,
          },
        },
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            phone: true,
          },
        },
      },
    }),
  ]);

  return {
    bookings,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Retrieves a single booking by ID with strict tenant isolation.
 */
export async function getBookingById(id: string, user: User) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      property: {
        select: {
          id: true,
          title: true,
          address: true,
          city: true,
          propertyType: true,
          ownerId: true,
          images: {
            take: 1,
            orderBy: { displayOrder: "asc" },
            select: { url: true },
          },
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      },
      room: {
        select: {
          id: true,
          roomNumber: true,
          roomType: true,
          capacity: true,
          currentOccupancy: true,
        },
      },
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          phone: true,
        },
      },
    },
  });

  if (!booking) {
    throw new AuthException(404, "NOT_FOUND", "Booking not found");
  }

  // Authorization check
  const isStudent = user.role === Role.STUDENT && booking.studentId === user.id;
  const isOwner = user.role === Role.OWNER && booking.property.ownerId === user.id;
  const isAdmin = user.role === Role.ADMIN;

  if (!isStudent && !isOwner && !isAdmin) {
    throw new AuthException(
      403,
      "FORBIDDEN",
      "You do not have permission to view this booking"
    );
  }

  return booking;
}

/**
 * Updates a booking status with strict state machine and role validation.
 */
export async function updateBookingStatus(
  id: string,
  user: User,
  input: UpdateBookingStatusInput
) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      property: {
        select: {
          ownerId: true,
        },
      },
    },
  });

  if (!booking) {
    throw new AuthException(404, "NOT_FOUND", "Booking not found");
  }

  const { status: newStatus } = input;

  // 1. STUDENT CAN ONLY CANCEL
  if (user.role === Role.STUDENT) {
    if (booking.studentId !== user.id) {
      throw new AuthException(
        403,
        "FORBIDDEN",
        "You can only modify your own bookings"
      );
    }

    if (newStatus !== BookingStatus.CANCELLED) {
      throw new AuthException(
        403,
        "FORBIDDEN",
        "Students are only permitted to cancel their bookings"
      );
    }

    const cancellableStatuses: BookingStatus[] = [
      BookingStatus.PENDING,
      BookingStatus.CONFIRMED,
    ];
    if (!cancellableStatuses.includes(booking.status)) {
      throw new AuthException(
        400,
        "BAD_REQUEST",
        `Cannot cancel a booking with status ${booking.status}`
      );
    }
  }

  // 2. OWNER CAN CONFIRM, REJECT, OR CANCEL
  else if (user.role === Role.OWNER) {
    if (booking.property.ownerId !== user.id) {
      throw new AuthException(
        403,
        "FORBIDDEN",
        "You do not have permission to manage bookings for this property"
      );
    }

    // From PENDING: can transition to CONFIRMED, REJECTED, or CANCELLED
    if (booking.status === BookingStatus.PENDING) {
      const allowedFromPending: BookingStatus[] = [
        BookingStatus.CONFIRMED,
        BookingStatus.REJECTED,
        BookingStatus.CANCELLED,
      ];
      if (!allowedFromPending.includes(newStatus)) {
        throw new AuthException(
          400,
          "BAD_REQUEST",
          `Invalid status transition from PENDING to ${newStatus}`
        );
      }
    }
    // From CONFIRMED: can transition to COMPLETED or CANCELLED
    else if (booking.status === BookingStatus.CONFIRMED) {
      const allowedFromConfirmed: BookingStatus[] = [
        BookingStatus.COMPLETED,
        BookingStatus.CANCELLED,
      ];
      if (!allowedFromConfirmed.includes(newStatus)) {
        throw new AuthException(
          400,
          "BAD_REQUEST",
          `Invalid status transition from CONFIRMED to ${newStatus}`
        );
      }
    }
    // Terminal states
    else {
      throw new AuthException(
        400,
        "BAD_REQUEST",
        `Cannot update a booking that is already ${booking.status}`
      );
    }
  }

  // 3. ADMIN HAS FULL TRANSITION AUTHORITY
  else if (user.role !== Role.ADMIN) {
    throw new AuthException(
      403,
      "FORBIDDEN",
      "Unauthorized role for booking management"
    );
  }

  // Apply update
  const updatedBooking = await prisma.booking.update({
    where: { id },
    data: {
      status: newStatus,
    },
    include: {
      property: {
        select: {
          id: true,
          title: true,
        },
      },
      room: {
        select: {
          id: true,
          roomNumber: true,
        },
      },
      student: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  // Trigger notifications on status transitions
  if (newStatus === BookingStatus.CONFIRMED) {
    createNotification({
      userId: updatedBooking.student.id,
      type: NotificationType.BOOKING_UPDATE,
      title: "Booking Confirmed",
      message: `Your booking for ${updatedBooking.property.title} has been confirmed.`,
      link: `/bookings/${updatedBooking.id}`,
    }).catch((err) => console.error("Failed to send confirmation notification", err));
  } else if (newStatus === BookingStatus.REJECTED) {
    createNotification({
      userId: updatedBooking.student.id,
      type: NotificationType.BOOKING_UPDATE,
      title: "Booking Request Rejected",
      message: `Your booking request for ${updatedBooking.property.title} was rejected.`,
      link: `/bookings/${updatedBooking.id}`,
    }).catch((err) => console.error("Failed to send rejection notification", err));
  } else if (newStatus === BookingStatus.CANCELLED) {
    const notifyRecipientId =
      user.id === updatedBooking.student.id
        ? booking.property.ownerId
        : updatedBooking.student.id;
    createNotification({
      userId: notifyRecipientId,
      type: NotificationType.BOOKING_UPDATE,
      title: "Booking Cancelled",
      message: `Booking for ${updatedBooking.property.title} has been cancelled.`,
      link: `/bookings/${updatedBooking.id}`,
    }).catch((err) => console.error("Failed to send cancellation notification", err));
  }

  return updatedBooking;
}

/**
 * Safely cancels a booking (soft cancellation rather than destructive row deletion).
 * Preserves historical audit records while freeing the reservation.
 */
export async function cancelBooking(id: string, user: User) {
  return updateBookingStatus(id, user, {
    status: BookingStatus.CANCELLED,
  });
}

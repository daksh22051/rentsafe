import { prisma } from "@/lib/prisma";
import { AuthException } from "@/lib/api-response";
import {
  AdminUserQueryInput,
  AdminPropertyQueryInput,
  AdminBookingQueryInput,
} from "@/lib/validations/admin";
import {
  Role,
  PropertyVerificationStatus,
  BookingStatus,
  ComplaintStatus,
  VerificationStatus,
  Prisma,
} from "@prisma/client";

/**
 * Retrieves aggregate platform statistics across users, properties, bookings,
 * complaints, and verification requests using efficient database queries.
 */
export async function getAdminDashboardSummary() {
  const [
    totalUsers,
    totalStudents,
    totalOwners,
    totalAdmins,
    totalProperties,
    verifiedProperties,
    pendingProperties,
    rejectedProperties,
    unverifiedProperties,
    totalBookings,
    pendingBookings,
    confirmedBookings,
    completedBookings,
    cancelledBookings,
    rejectedBookings,
    totalReviews,
    totalComplaints,
    unresolvedComplaints,
    resolvedComplaints,
    totalVerifications,
    pendingVerifications,
    approvedVerifications,
    rejectedVerifications,
  ] = await Promise.all([
    // User counts
    prisma.user.count(),
    prisma.user.count({ where: { role: Role.STUDENT } }),
    prisma.user.count({ where: { role: Role.OWNER } }),
    prisma.user.count({ where: { role: Role.ADMIN } }),

    // Property counts
    prisma.property.count(),
    prisma.property.count({
      where: { verificationStatus: PropertyVerificationStatus.VERIFIED },
    }),
    prisma.property.count({
      where: { verificationStatus: PropertyVerificationStatus.PENDING },
    }),
    prisma.property.count({
      where: { verificationStatus: PropertyVerificationStatus.REJECTED },
    }),
    prisma.property.count({
      where: { verificationStatus: PropertyVerificationStatus.UNVERIFIED },
    }),

    // Booking counts
    prisma.booking.count(),
    prisma.booking.count({ where: { status: BookingStatus.PENDING } }),
    prisma.booking.count({ where: { status: BookingStatus.CONFIRMED } }),
    prisma.booking.count({ where: { status: BookingStatus.COMPLETED } }),
    prisma.booking.count({ where: { status: BookingStatus.CANCELLED } }),
    prisma.booking.count({ where: { status: BookingStatus.REJECTED } }),

    // Review counts
    prisma.review.count(),

    // Complaint counts
    prisma.complaint.count(),
    prisma.complaint.count({
      where: {
        status: {
          in: [
            ComplaintStatus.SUBMITTED,
            ComplaintStatus.UNDER_REVIEW,
            ComplaintStatus.IN_PROGRESS,
          ],
        },
      },
    }),
    prisma.complaint.count({
      where: { status: ComplaintStatus.RESOLVED },
    }),

    // Verification counts
    prisma.verification.count(),
    prisma.verification.count({
      where: {
        status: {
          in: [VerificationStatus.PENDING, VerificationStatus.ADMIN_REVIEW],
        },
      },
    }),
    prisma.verification.count({
      where: {
        status: {
          in: [VerificationStatus.APPROVED, VerificationStatus.VERIFIED],
        },
      },
    }),
    prisma.verification.count({
      where: { status: VerificationStatus.REJECTED },
    }),
  ]);

  return {
    users: {
      total: totalUsers,
      students: totalStudents,
      owners: totalOwners,
      admins: totalAdmins,
    },
    properties: {
      total: totalProperties,
      verified: verifiedProperties,
      pending: pendingProperties,
      rejected: rejectedProperties,
      unverified: unverifiedProperties,
    },
    bookings: {
      total: totalBookings,
      pending: pendingBookings,
      confirmed: confirmedBookings,
      completed: completedBookings,
      cancelled: cancelledBookings,
      rejected: rejectedBookings,
    },
    reviews: {
      total: totalReviews,
    },
    complaints: {
      total: totalComplaints,
      unresolved: unresolvedComplaints,
      resolved: resolvedComplaints,
    },
    verifications: {
      total: totalVerifications,
      pending: pendingVerifications,
      approved: approvedVerifications,
      rejected: rejectedVerifications,
    },
  };
}

/**
 * Retrieves paginated list of users with search and role filtering.
 * Excludes sensitive credentials, government IDs, and secret tokens.
 */
export async function getAdminUsers(query: AdminUserQueryInput) {
  const page = query.page || 1;
  const limit = Math.min(query.limit || 20, 100);
  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {
    ...(query.role ? { role: query.role } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { email: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        phone: true,
        role: true,
        isEmailVerified: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            properties: true,
            bookings: true,
            reviews: true,
            complaints: true,
          },
        },
      },
    }),
  ]);

  return {
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Retrieves a detailed view of a user for administrative oversight.
 */
export async function getAdminUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      phone: true,
      role: true,
      isEmailVerified: true,
      createdAt: true,
      updatedAt: true,
      ownerProfile: {
        select: {
          id: true,
          businessName: true,
          isVerified: true,
          verificationNotes: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          properties: true,
          bookings: true,
          reviews: true,
          complaints: true,
          favorites: true,
        },
      },
    },
  });

  if (!user) {
    throw new AuthException(
      404,
      "ADMIN_USER_NOT_FOUND",
      "User not found"
    );
  }

  return user;
}

/**
 * Updates a user's role with strict admin self-protection and last-admin preservation.
 */
export async function updateUserRole(
  targetUserId: string,
  currentAdminId: string,
  newRole: Role
) {
  // 1. Fetch target user
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!targetUser) {
    throw new AuthException(
      404,
      "ADMIN_USER_NOT_FOUND",
      "User not found"
    );
  }

  // 2. Self-protection: Admin cannot modify their own role
  if (targetUserId === currentAdminId) {
    throw new AuthException(
      400,
      "ROLE_CHANGE_NOT_ALLOWED",
      "Administrators cannot modify their own role"
    );
  }

  // 3. Last admin protection: Cannot demote the last remaining administrator
  if (targetUser.role === Role.ADMIN && newRole !== Role.ADMIN) {
    const adminCount = await prisma.user.count({
      where: { role: Role.ADMIN },
    });

    if (adminCount <= 1) {
      throw new AuthException(
        400,
        "ROLE_CHANGE_NOT_ALLOWED",
        "Cannot demote the last remaining administrator on the platform"
      );
    }
  }

  // 4. Update role
  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: { role: newRole },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      updatedAt: true,
    },
  });

  return updatedUser;
}

/**
 * Retrieves paginated platform properties with administrative filters and owner summary.
 */
export async function getAdminProperties(query: AdminPropertyQueryInput) {
  const page = query.page || 1;
  const limit = Math.min(query.limit || 20, 100);
  const skip = (page - 1) * limit;

  const where: Prisma.PropertyWhereInput = {
    ...(query.city ? { city: { equals: query.city, mode: "insensitive" } } : {}),
    ...(query.verificationStatus ? { verificationStatus: query.verificationStatus } : {}),
    ...(query.propertyType ? { propertyType: query.propertyType } : {}),
    ...(query.isAvailable !== undefined ? { isAvailable: query.isAvailable } : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: "insensitive" } },
            { address: { contains: query.search, mode: "insensitive" } },
            { city: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, properties] = await Promise.all([
    prisma.property.count({ where }),
    prisma.property.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        propertyType: true,
        address: true,
        city: true,
        rent: true,
        securityDeposit: true,
        furnishedStatus: true,
        isAvailable: true,
        verificationStatus: true,
        trustScore: true,
        createdAt: true,
        updatedAt: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            rooms: true,
            bookings: true,
            reviews: true,
            complaints: true,
            verifications: true,
          },
        },
      },
    }),
  ]);

  return {
    properties,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Retrieves paginated platform bookings with administrative filters and financial summary.
 */
export async function getAdminBookings(query: AdminBookingQueryInput) {
  const page = query.page || 1;
  const limit = Math.min(query.limit || 20, 100);
  const skip = (page - 1) * limit;

  const where: Prisma.BookingWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.propertyId ? { propertyId: query.propertyId } : {}),
    ...(query.studentId ? { studentId: query.studentId } : {}),
    ...(query.ownerId
      ? {
          property: {
            ownerId: query.ownerId,
          },
        }
      : {}),
  };

  const [total, bookings] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        moveInDate: true,
        moveOutDate: true,
        rentAmount: true,
        depositAmount: true,
        totalAmount: true,
        createdAt: true,
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        property: {
          select: {
            id: true,
            title: true,
            city: true,
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
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

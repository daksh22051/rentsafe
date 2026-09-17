import { prisma } from "@/lib/prisma";
import { AuthException } from "@/lib/api-response";
import {
  CreateComplaintInput,
  UpdateComplaintStatusInput,
  ComplaintQueryInput,
} from "@/lib/validations/complaint";
import { BookingStatus, ComplaintStatus, NotificationType, Role, User, Prisma } from "@prisma/client";
import { createNotification } from "./notification.service";

/**
 * Creates a complaint for a property by an authenticated student.
 * Verifies property existence and requires an eligible booking (CONFIRMED or COMPLETED).
 */
export async function createComplaint(
  userId: string,
  input: CreateComplaintInput
) {
  // 1. Verify property exists
  const property = await prisma.property.findUnique({
    where: { id: input.propertyId },
    select: { id: true, title: true, ownerId: true },
  });

  if (!property) {
    throw new AuthException(
      404,
      "COMPLAINT_PROPERTY_NOT_FOUND",
      "Property not found"
    );
  }

  // 2. Require an active or past stay (CONFIRMED or COMPLETED booking)
  const eligibleBooking = await prisma.booking.findFirst({
    where: {
      studentId: userId,
      propertyId: input.propertyId,
      status: {
        in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED],
      },
    },
  });

  if (!eligibleBooking) {
    throw new AuthException(
      403,
      "COMPLAINT_REQUIRES_BOOKING",
      "You must have a confirmed or completed booking for this property to file a complaint."
    );
  }

  // 3. Create complaint in database
  const complaint = await prisma.complaint.create({
    data: {
      userId,
      propertyId: input.propertyId,
      complaintType: input.complaintType,
      description: input.description,
      evidenceUrls: input.evidenceUrls || [],
      status: ComplaintStatus.SUBMITTED,
    },
    include: {
      property: {
        select: {
          id: true,
          title: true,
          address: true,
          ownerId: true,
        },
      },
      user: {
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
    type: NotificationType.COMPLAINT_UPDATE,
    title: "New Complaint Filed",
    message: `A complaint has been filed regarding ${property.title}.`,
    link: `/complaints/${complaint.id}`,
  }).catch((err) => console.error("Failed to send complaint creation notification", err));

  return complaint;
}

/**
 * Retrieves paginated complaints filtered by role and optional query parameters.
 * - STUDENT: sees only their own filed complaints.
 * - OWNER: sees only complaints for properties they own.
 * - ADMIN: sees all complaints across the platform.
 */
export async function getComplaints(
  user: User,
  query: ComplaintQueryInput
) {
  const page = query.page || 1;
  const limit = Math.min(query.limit || 10, 100);
  const skip = (page - 1) * limit;

  // Build role-scoped where clause
  const where: Prisma.ComplaintWhereInput = {};

  if (user.role === Role.STUDENT) {
    where.userId = user.id;
  } else if (user.role === Role.OWNER) {
    where.property = {
      ownerId: user.id,
    };
  }
  // ADMIN has no scope restriction

  // Apply optional query filters
  if (query.status) {
    where.status = query.status;
  }

  if (query.complaintType) {
    where.complaintType = query.complaintType;
  }

  if (query.propertyId) {
    if (user.role === Role.OWNER) {
      where.property = {
        id: query.propertyId,
        ownerId: user.id,
      };
    } else {
      where.propertyId = query.propertyId;
    }
  }

  const [total, complaints] = await Promise.all([
    prisma.complaint.count({ where }),
    prisma.complaint.findMany({
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
            ownerId: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        handledBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
  ]);

  return {
    complaints,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Retrieves a single complaint by ID with IDOR protection.
 * - STUDENT: can only view their own complaint.
 * - OWNER: can only view complaints for their properties.
 * - ADMIN: can view any complaint.
 */
export async function getComplaintById(complaintId: string, user: User) {
  const complaint = await prisma.complaint.findUnique({
    where: { id: complaintId },
    include: {
      property: {
        select: {
          id: true,
          title: true,
          address: true,
          ownerId: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
      handledBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!complaint) {
    throw new AuthException(404, "COMPLAINT_NOT_FOUND", "Complaint not found");
  }

  // IDOR check based on role
  if (user.role === Role.STUDENT && complaint.userId !== user.id) {
    throw new AuthException(
      403,
      "UNAUTHORIZED_COMPLAINT_ACCESS",
      "You are not authorized to view this complaint"
    );
  }

  if (user.role === Role.OWNER && complaint.property.ownerId !== user.id) {
    throw new AuthException(
      403,
      "UNAUTHORIZED_COMPLAINT_ACCESS",
      "You are not authorized to view complaints for properties you do not own"
    );
  }

  return complaint;
}

/**
 * Updates complaint status and admin/owner notes.
 * Restricted to OWNER (for their properties) and ADMIN.
 * Validates status transitions to prevent erratic states.
 */
export async function updateComplaintStatus(
  complaintId: string,
  user: User,
  input: UpdateComplaintStatusInput
) {
  // 1. Role check: Students cannot update complaint status
  if (user.role === Role.STUDENT) {
    throw new AuthException(
      403,
      "FORBIDDEN",
      "Students are not permitted to change complaint status"
    );
  }

  // 2. Fetch complaint and property relation
  const complaint = await prisma.complaint.findUnique({
    where: { id: complaintId },
    include: {
      property: {
        select: {
          id: true,
          title: true,
          address: true,
          ownerId: true,
        },
      },
    },
  });

  if (!complaint) {
    throw new AuthException(404, "COMPLAINT_NOT_FOUND", "Complaint not found");
  }

  // 3. Owner permission check: only for their own properties
  if (user.role === Role.OWNER && complaint.property.ownerId !== user.id) {
    throw new AuthException(
      403,
      "UNAUTHORIZED_COMPLAINT_ACCESS",
      "You can only manage complaints for properties you own"
    );
  }

  // 4. Status transition validation
  const validTransitions: Record<ComplaintStatus, ComplaintStatus[]> = {
    [ComplaintStatus.SUBMITTED]: [
      ComplaintStatus.UNDER_REVIEW,
      ComplaintStatus.IN_PROGRESS,
      ComplaintStatus.RESOLVED,
    ],
    [ComplaintStatus.UNDER_REVIEW]: [
      ComplaintStatus.IN_PROGRESS,
      ComplaintStatus.RESOLVED,
    ],
    [ComplaintStatus.IN_PROGRESS]: [
      ComplaintStatus.UNDER_REVIEW,
      ComplaintStatus.RESOLVED,
    ],
    [ComplaintStatus.RESOLVED]:
      user.role === Role.ADMIN
        ? [ComplaintStatus.UNDER_REVIEW, ComplaintStatus.IN_PROGRESS]
        : [],
  };

  if (
    complaint.status !== input.status &&
    !validTransitions[complaint.status]?.includes(input.status)
  ) {
    throw new AuthException(
      400,
      "INVALID_COMPLAINT_STATUS",
      `Cannot transition complaint status from ${complaint.status} to ${input.status}`
    );
  }

  // 5. Update status, notes, handler, and resolvedAt timestamp
  const resolvedAt =
    input.status === ComplaintStatus.RESOLVED
      ? complaint.resolvedAt || new Date()
      : null;

  const updatedComplaint = await prisma.complaint.update({
    where: { id: complaintId },
    data: {
      status: input.status,
      adminNotes:
        input.adminNotes !== undefined ? input.adminNotes : complaint.adminNotes,
      handledById: user.id,
      resolvedAt,
    },
    include: {
      property: {
        select: {
          id: true,
          title: true,
          address: true,
          ownerId: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
      handledBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  // Trigger complainant notification
  createNotification({
    userId: complaint.userId,
    type: NotificationType.COMPLAINT_UPDATE,
    title: "Complaint Status Updated",
    message: `Your complaint regarding ${updatedComplaint.property.title} is now ${input.status}.`,
    link: `/complaints/${updatedComplaint.id}`,
  }).catch((err) => console.error("Failed to send complaint update notification", err));

  return updatedComplaint;
}

/**
 * Closes a complaint via status resolution rather than hard-deleting the record,
 * preserving audit integrity.
 * Permitted only for the student complainant or an ADMIN.
 */
export async function closeComplaint(complaintId: string, user: User) {
  const complaint = await prisma.complaint.findUnique({
    where: { id: complaintId },
    include: {
      property: {
        select: {
          id: true,
          title: true,
          address: true,
          ownerId: true,
        },
      },
    },
  });

  if (!complaint) {
    throw new AuthException(404, "COMPLAINT_NOT_FOUND", "Complaint not found");
  }

  // Only the complaint creator or an ADMIN can close/withdraw the complaint
  const isCreator = complaint.userId === user.id;
  const isAdmin = user.role === Role.ADMIN;

  if (!isCreator && !isAdmin) {
    throw new AuthException(
      403,
      "FORBIDDEN",
      "Only the complaint creator or an administrator can close this complaint"
    );
  }

  // If already resolved, return as-is
  if (complaint.status === ComplaintStatus.RESOLVED) {
    return complaint;
  }

  const closureNote = isCreator
    ? `[Closed by complainant]`
    : `[Closed by admin ${user.name || user.email}]`;

  const updatedNotes = complaint.adminNotes
    ? `${complaint.adminNotes}\n${closureNote}`
    : closureNote;

  const closedComplaint = await prisma.complaint.update({
    where: { id: complaintId },
    data: {
      status: ComplaintStatus.RESOLVED,
      resolvedAt: new Date(),
      adminNotes: updatedNotes,
      handledById: user.id,
    },
    include: {
      property: {
        select: {
          id: true,
          title: true,
          address: true,
          ownerId: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
      handledBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return closedComplaint;
}

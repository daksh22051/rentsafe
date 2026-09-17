import { prisma } from "@/lib/prisma";
import { AuthException } from "@/lib/api-response";
import {
  SubmitVerificationInput,
  AdminUpdateVerificationInput,
  VerificationQueryInput,
} from "@/lib/validations/verification";
import { createNotification } from "./notification.service";
import {
  VerificationStatus,
  PropertyVerificationStatus,
  NotificationType,
  Role,
  User,
  Prisma,
} from "@prisma/client";

/**
 * Submits a new verification request for a property by its authenticated owner.
 * Validates ownership, checks for pending duplicate requests, and synchronizes Property status to PENDING.
 */
export async function submitVerification(
  ownerId: string,
  input: SubmitVerificationInput
) {
  // 1. Verify property exists
  const property = await prisma.property.findUnique({
    where: { id: input.propertyId },
    select: {
      id: true,
      ownerId: true,
      title: true,
      verificationStatus: true,
    },
  });

  if (!property) {
    throw new AuthException(404, "PROPERTY_NOT_FOUND", "Property not found");
  }

  // 2. Ownership check
  if (property.ownerId !== ownerId) {
    throw new AuthException(
      403,
      "UNAUTHORIZED_VERIFICATION_ACCESS",
      "You can only submit verification for properties you own"
    );
  }

  // 3. Prevent duplicate active verification requests
  const activeVerification = await prisma.verification.findFirst({
    where: {
      propertyId: input.propertyId,
      status: {
        in: [VerificationStatus.PENDING, VerificationStatus.ADMIN_REVIEW],
      },
    },
  });

  if (activeVerification) {
    throw new AuthException(
      409,
      "VERIFICATION_ALREADY_EXISTS",
      "An active verification request is already in progress for this property"
    );
  }

  // 4. Find owner's profile if established
  const ownerProfile = await prisma.ownerProfile.findUnique({
    where: { userId: ownerId },
    select: { id: true },
  });

  // 5. Create verification and sync property verification status atomically
  const [verification] = await prisma.$transaction([
    prisma.verification.create({
      data: {
        propertyId: input.propertyId,
        ownerProfileId: ownerProfile?.id ?? null,
        status: VerificationStatus.PENDING,
        documentType: input.documentType,
        documentUrl: input.documentUrl ?? null,
        submittedNotes: input.submittedNotes ?? null,
      },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            address: true,
            city: true,
            verificationStatus: true,
          },
        },
      },
    }),
    prisma.property.update({
      where: { id: input.propertyId },
      data: {
        verificationStatus: PropertyVerificationStatus.PENDING,
      },
    }),
  ]);

  return verification;
}

/**
 * Retrieves paginated verification requests submitted by the authenticated owner.
 */
export async function getMyVerifications(
  ownerId: string,
  query: VerificationQueryInput
) {
  const page = query.page || 1;
  const limit = Math.min(query.limit || 20, 100);
  const skip = (page - 1) * limit;

  const where: Prisma.VerificationWhereInput = {
    property: {
      ownerId,
    },
    ...(query.status ? { status: query.status } : {}),
    ...(query.propertyId ? { propertyId: query.propertyId } : {}),
  };

  const [total, verifications] = await Promise.all([
    prisma.verification.count({ where }),
    prisma.verification.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        propertyId: true,
        status: true,
        documentType: true,
        documentUrl: true,
        submittedNotes: true,
        rejectionReason: true,
        verifiedAt: true,
        createdAt: true,
        updatedAt: true,
        property: {
          select: {
            id: true,
            title: true,
            address: true,
            city: true,
            verificationStatus: true,
          },
        },
      },
    }),
  ]);

  return {
    verifications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Retrieves a single verification request with strict IDOR protections.
 * - OWNER: can only view verifications for their properties.
 * - ADMIN: can view any verification.
 * - STUDENT: forbidden.
 */
export async function getVerificationById(id: string, user: User) {
  if (user.role === Role.STUDENT) {
    throw new AuthException(
      403,
      "UNAUTHORIZED_VERIFICATION_ACCESS",
      "Students are not permitted to view verification records"
    );
  }

  const verification = await prisma.verification.findUnique({
    where: { id },
    include: {
      property: {
        select: {
          id: true,
          title: true,
          address: true,
          city: true,
          ownerId: true,
          verificationStatus: true,
        },
      },
      reviewedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!verification) {
    throw new AuthException(
      404,
      "VERIFICATION_NOT_FOUND",
      "Verification request not found"
    );
  }

  if (user.role === Role.OWNER && verification.property.ownerId !== user.id) {
    throw new AuthException(
      403,
      "UNAUTHORIZED_VERIFICATION_ACCESS",
      "You can only view verification records for your own properties"
    );
  }

  return verification;
}

/**
 * Lists all verification requests across the platform for administrators.
 */
export async function getAdminVerifications(query: VerificationQueryInput) {
  const page = query.page || 1;
  const limit = Math.min(query.limit || 20, 100);
  const skip = (page - 1) * limit;

  const where: Prisma.VerificationWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.propertyId ? { propertyId: query.propertyId } : {}),
  };

  const [total, verifications] = await Promise.all([
    prisma.verification.count({ where }),
    prisma.verification.findMany({
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
            verificationStatus: true,
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        reviewedBy: {
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
    verifications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Updates verification status (approval, rejection, or under review) by an administrator.
 * Synchronizes Property.verificationStatus atomically and dispatches notifications to owner.
 */
export async function updateVerificationStatus(
  id: string,
  adminId: string,
  input: AdminUpdateVerificationInput
) {
  // 1. Fetch verification and associated property
  const verification = await prisma.verification.findUnique({
    where: { id },
    include: {
      property: {
        select: {
          id: true,
          title: true,
          ownerId: true,
          verificationStatus: true,
        },
      },
    },
  });

  if (!verification) {
    throw new AuthException(
      404,
      "VERIFICATION_NOT_FOUND",
      "Verification request not found"
    );
  }

  // 2. Safe state transition validation
  const validTransitions: Record<VerificationStatus, VerificationStatus[]> = {
    [VerificationStatus.PENDING]: [
      VerificationStatus.ADMIN_REVIEW,
      VerificationStatus.APPROVED,
      VerificationStatus.VERIFIED,
      VerificationStatus.REJECTED,
    ],
    [VerificationStatus.ADMIN_REVIEW]: [
      VerificationStatus.APPROVED,
      VerificationStatus.VERIFIED,
      VerificationStatus.REJECTED,
    ],
    [VerificationStatus.APPROVED]: [
      VerificationStatus.ADMIN_REVIEW,
      VerificationStatus.REJECTED,
      VerificationStatus.VERIFIED,
    ],
    [VerificationStatus.VERIFIED]: [
      VerificationStatus.ADMIN_REVIEW,
      VerificationStatus.REJECTED,
    ],
    [VerificationStatus.REJECTED]: [
      VerificationStatus.ADMIN_REVIEW,
      VerificationStatus.APPROVED,
      VerificationStatus.VERIFIED,
    ],
  };

  if (
    verification.status !== input.status &&
    !validTransitions[verification.status]?.includes(input.status)
  ) {
    throw new AuthException(
      400,
      "INVALID_VERIFICATION_STATUS",
      `Cannot transition verification status from ${verification.status} to ${input.status}`
    );
  }

  // 3. Determine synchronized PropertyVerificationStatus
  let propertyVerificationStatus: PropertyVerificationStatus;
  let verifiedAt: Date | null = null;
  let rejectionReason: string | null = null;

  if (
    input.status === VerificationStatus.APPROVED ||
    input.status === VerificationStatus.VERIFIED
  ) {
    propertyVerificationStatus = PropertyVerificationStatus.VERIFIED;
    verifiedAt = new Date();
    rejectionReason = null;
  } else if (input.status === VerificationStatus.REJECTED) {
    propertyVerificationStatus = PropertyVerificationStatus.REJECTED;
    verifiedAt = null;
    rejectionReason = input.rejectionReason ?? null;
  } else {
    propertyVerificationStatus = PropertyVerificationStatus.PENDING;
    verifiedAt = null;
    rejectionReason = input.rejectionReason ?? verification.rejectionReason;
  }

  // 4. Update Verification and Property atomically
  const [updatedVerification] = await prisma.$transaction([
    prisma.verification.update({
      where: { id },
      data: {
        status: input.status,
        reviewedById: adminId,
        rejectionReason,
        verifiedAt,
      },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            address: true,
            city: true,
            ownerId: true,
            verificationStatus: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.property.update({
      where: { id: verification.propertyId },
      data: {
        verificationStatus: propertyVerificationStatus,
      },
    }),
  ]);

  // 5. Notify property owner non-blockingly
  if (
    input.status === VerificationStatus.APPROVED ||
    input.status === VerificationStatus.VERIFIED
  ) {
    createNotification({
      userId: verification.property.ownerId,
      type: NotificationType.VERIFICATION_UPDATE,
      title: "Property Verification Approved",
      message: `Your property verification request for ${verification.property.title} has been approved.`,
      link: `/properties/${verification.property.id}`,
    }).catch((err) =>
      console.error("Failed to send verification approval notification", err)
    );
  } else if (input.status === VerificationStatus.REJECTED) {
    createNotification({
      userId: verification.property.ownerId,
      type: NotificationType.VERIFICATION_UPDATE,
      title: "Property Verification Update",
      message: `Your property verification request for ${verification.property.title} was rejected: ${input.rejectionReason}`,
      link: `/verifications/my`,
    }).catch((err) =>
      console.error("Failed to send verification rejection notification", err)
    );
  }

  return updatedVerification;
}

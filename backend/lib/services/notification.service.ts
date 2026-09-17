import { prisma } from "@/lib/prisma";
import { AuthException } from "@/lib/api-response";
import { NotificationQueryInput } from "@/lib/validations/notification";
import { NotificationType, Prisma } from "@prisma/client";

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
}

/**
 * Creates a notification for a user.
 * Internal service method to be invoked only by trusted backend events.
 */
export async function createNotification(params: CreateNotificationParams) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link ?? null,
    },
  });
}

/**
 * Creates multiple notifications in a single database operation.
 */
export async function createNotifications(items: CreateNotificationParams[]) {
  if (items.length === 0) return { count: 0 };

  return prisma.notification.createMany({
    data: items.map((item) => ({
      userId: item.userId,
      type: item.type,
      title: item.title,
      message: item.message,
      link: item.link ?? null,
    })),
  });
}

/**
 * Retrieves paginated notifications belonging strictly to the authenticated user.
 */
export async function getNotifications(
  userId: string,
  query: NotificationQueryInput
) {
  const page = query.page || 1;
  const limit = Math.min(query.limit || 20, 100);
  const skip = (page - 1) * limit;

  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(query.isRead !== undefined ? { isRead: query.isRead } : {}),
    ...(query.type ? { type: query.type } : {}),
  };

  const [total, notifications] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        link: true,
        isRead: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    notifications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Counts unread notifications for the authenticated user.
 */
export async function getUnreadNotificationCount(userId: string) {
  const unreadCount = await prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });

  return { unreadCount };
}

/**
 * Marks a single notification as read/unread with IDOR prevention.
 */
export async function markNotificationAsRead(
  userId: string,
  notificationId: string,
  isRead = true
) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new AuthException(
      404,
      "NOTIFICATION_NOT_FOUND",
      "Notification not found"
    );
  }

  if (notification.userId !== userId) {
    throw new AuthException(
      403,
      "UNAUTHORIZED_NOTIFICATION_ACCESS",
      "You are not authorized to update this notification"
    );
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead },
    select: {
      id: true,
      type: true,
      title: true,
      message: true,
      link: true,
      isRead: true,
      createdAt: true,
    },
  });

  return updated;
}

/**
 * Marks all unread notifications belonging to the authenticated user as read.
 */
export async function markAllNotificationsAsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
    },
  });

  return { updatedCount: result.count };
}

/**
 * Deletes a notification belonging to the authenticated user with IDOR prevention.
 */
export async function deleteNotification(
  userId: string,
  notificationId: string
) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new AuthException(
      404,
      "NOTIFICATION_NOT_FOUND",
      "Notification not found"
    );
  }

  if (notification.userId !== userId) {
    throw new AuthException(
      403,
      "UNAUTHORIZED_NOTIFICATION_ACCESS",
      "You are not authorized to delete this notification"
    );
  }

  await prisma.notification.delete({
    where: { id: notificationId },
  });

  return { message: "Notification deleted successfully" };
}

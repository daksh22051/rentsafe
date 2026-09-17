import { requireUser } from "@/lib/auth";
import { markAllNotificationsAsRead } from "@/lib/services/notification.service";
import { successResponse, handleApiError } from "@/lib/api-response";

/**
 * PATCH /api/notifications/read-all
 * Marks all unread notifications for the authenticated user as read.
 */
export async function PATCH() {
  try {
    const user = await requireUser();

    const result = await markAllNotificationsAsRead(user.id);
    return successResponse(result, 200, "All notifications marked as read");
  } catch (error) {
    return handleApiError(error);
  }
}

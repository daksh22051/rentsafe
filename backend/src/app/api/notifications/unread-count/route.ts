import { requireUser } from "@/lib/auth";
import { getUnreadNotificationCount } from "@/lib/services/notification.service";
import { successResponse, handleApiError } from "@/lib/api-response";

/**
 * GET /api/notifications/unread-count
 * Returns the count of unread notifications for the authenticated user.
 */
export async function GET() {
  try {
    const user = await requireUser();

    const result = await getUnreadNotificationCount(user.id);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

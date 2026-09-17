import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  notificationParamSchema,
  updateNotificationSchema,
} from "@/lib/validations/notification";
import {
  markNotificationAsRead,
  deleteNotification,
} from "@/lib/services/notification.service";
import { successResponse, handleApiError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * PATCH /api/notifications/[id]
 * Marks a single notification as read or unread.
 */
export async function PATCH(request: NextRequest, context: RouteParams) {
  try {
    const user = await requireUser();
    const { id } = await context.params;

    notificationParamSchema.parse({ id });

    const body = await request.json();
    const validatedData = updateNotificationSchema.parse(body);

    const updated = await markNotificationAsRead(
      user.id,
      id,
      validatedData.isRead
    );
    return successResponse(updated, 200, "Notification updated successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/notifications/[id]
 * Deletes a single notification belonging to the authenticated user.
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteParams
) {
  void _request;
  try {
    const user = await requireUser();
    const { id } = await context.params;

    notificationParamSchema.parse({ id });

    const result = await deleteNotification(user.id, id);
    return successResponse(result, 200, result.message);
  } catch (error) {
    return handleApiError(error);
  }
}

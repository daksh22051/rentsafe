import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { notificationQuerySchema } from "@/lib/validations/notification";
import { getNotifications } from "@/lib/services/notification.service";
import { successResponse, handleApiError } from "@/lib/api-response";

/**
 * GET /api/notifications
 * Retrieves paginated notifications for the authenticated user (STUDENT, OWNER, or ADMIN).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();

    const searchParams = Object.fromEntries(
      request.nextUrl.searchParams.entries()
    );
    const validatedQuery = notificationQuerySchema.parse(searchParams);

    const result = await getNotifications(user.id, validatedQuery);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

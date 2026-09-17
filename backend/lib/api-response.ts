import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_SERVER_ERROR"
  | "REVIEW_REQUIRES_BOOKING"
  | "COMPLAINT_NOT_FOUND"
  | "INVALID_COMPLAINT"
  | "UNAUTHORIZED_COMPLAINT_ACCESS"
  | "COMPLAINT_PROPERTY_NOT_FOUND"
  | "COMPLAINT_REQUIRES_BOOKING"
  | "INVALID_COMPLAINT_STATUS"
  | "FAVORITE_ALREADY_EXISTS"
  | "FAVORITE_NOT_FOUND"
  | "PROPERTY_NOT_FOUND"
  | "INVALID_FAVORITE"
  | "ROOMMATE_PREFERENCES_NOT_FOUND"
  | "INVALID_ROOMMATE_PREFERENCES"
  | "ROOMMATE_MATCHES_UNAVAILABLE"
  | "NOTIFICATION_NOT_FOUND"
  | "UNAUTHORIZED_NOTIFICATION_ACCESS"
  | "INVALID_NOTIFICATION"
  | "VERIFICATION_NOT_FOUND"
  | "UNAUTHORIZED_VERIFICATION_ACCESS"
  | "INVALID_VERIFICATION"
  | "VERIFICATION_ALREADY_EXISTS"
  | "INVALID_VERIFICATION_STATUS"
  | "PAYMENT_NOT_FOUND"
  | "PAYMENT_NOT_ALLOWED"
  | "PAYMENT_PROVIDER_NOT_CONFIGURED"
  | "PAYMENT_ALREADY_COMPLETED"
  | "INVALID_PAYMENT_REQUEST"
  | "BOOKING_NOT_FOUND"
  | "ADMIN_ACCESS_REQUIRED"
  | "ADMIN_USER_NOT_FOUND"
  | "ADMIN_PROPERTY_NOT_FOUND"
  | "INVALID_ADMIN_REQUEST"
  | "ROLE_CHANGE_NOT_ALLOWED"
  | "ROOM_NOT_FOUND"
  | "ROOM_ACCESS_DENIED"
  | "INVALID_ROOM"
  | "ROOM_DELETE_NOT_ALLOWED"
  | "AMENITY_NOT_FOUND"
  | "PROPERTY_AMENITY_UPDATE_FAILED"
  | "PROPERTY_IMAGE_NOT_FOUND"
  | "PROPERTY_IMAGE_ACCESS_DENIED"
  | "INVALID_PROPERTY_IMAGE"
  | "RATE_LIMIT_EXCEEDED";

export interface ApiErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export class AuthException extends Error {
  statusCode: number;
  code: ErrorCode;

  constructor(statusCode: number, code: ErrorCode, message: string) {
    super(message);
    this.name = "AuthException";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function successResponse<T>(
  data: T,
  statusCode = 200,
  message?: string
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(message ? { message } : {}),
    },
    { status: statusCode }
  );
}

export function errorResponse(
  statusCode: number,
  code: ErrorCode,
  message: string,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    { status: statusCode }
  );
}

export function rateLimitResponse(
  retryAfterSeconds = 60,
  message = "Too many requests. Please try again later."
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message,
      },
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    }
  );
}

export function handleApiError(error: unknown): NextResponse<ApiErrorResponse> {
  if (error instanceof AuthException) {
    return errorResponse(error.statusCode, error.code, error.message);
  }

  if (error instanceof ZodError) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      "Invalid request data",
      error.flatten().fieldErrors
    );
  }

  // Safe server-side logging without exposing database credentials or internal traces to clients
  if (process.env.NODE_ENV === "development") {
    console.error("[INTERNAL_API_ERROR]", error);
  }

  // Never leak raw exception messages, Prisma errors, SQL statements, or stack traces to clients
  return errorResponse(
    500,
    "INTERNAL_SERVER_ERROR",
    "An unexpected server error occurred. Please try again later."
  );
}


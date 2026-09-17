import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Role, User, OwnerProfile, RoommatePreference } from "@prisma/client";
import { AuthException } from "@/lib/api-response";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";

export type SafeUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  phone: string | null;
  role: Role;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type UserProfile = SafeUser & {
  ownerProfile?: OwnerProfile | null;
  roommatePreference?: RoommatePreference | null;
};

/**
 * Returns a sanitized copy of the User record, safe for API responses.
 * Never exposes passwords, internal keys, or tokens.
 */
export function sanitizeUser(user: User): SafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    phone: user.phone,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Safely finds or creates a Prisma User record for a Supabase Auth user.
 * Guarantees no duplicate user records and enforces the Supabase Auth UUID as identity.
 */
export async function syncUserFromSupabase(
  authUser: SupabaseAuthUser,
  initialRole?: Role
): Promise<User> {
  if (!authUser.email) {
    throw new AuthException(
      400,
      "BAD_REQUEST",
      "Authenticated user must have an email address"
    );
  }

  // 1. Check if user already exists by Supabase Auth ID
  let user = await prisma.user.findUnique({
    where: { supabaseAuthId: authUser.id },
  });

  if (user) {
    return user;
  }

  // 2. Check if user exists by email (e.g. invited or pre-created)
  user = await prisma.user.findUnique({
    where: { email: authUser.email },
  });

  if (user) {
    // Link the existing user with the Supabase Auth ID
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        supabaseAuthId: authUser.id,
        isEmailVerified: !!authUser.email_confirmed_at,
      },
    });
    return user;
  }

  // 3. Create new User record in Prisma
  const userRole: Role =
    initialRole ?? (authUser.user_metadata?.role as Role) ?? Role.STUDENT;

  user = await prisma.user.create({
    data: {
      id: authUser.id,
      supabaseAuthId: authUser.id,
      email: authUser.email,
      name: (authUser.user_metadata?.name as string) ?? null,
      phone: (authUser.user_metadata?.phone as string) ?? null,
      role: userRole,
      isEmailVerified: !!authUser.email_confirmed_at,
    },
  });

  // If user signed up as an OWNER, automatically provision the OwnerProfile
  if (user.role === Role.OWNER) {
    await prisma.ownerProfile.create({
      data: {
        userId: user.id,
      },
    });
  }

  return user;
}

/**
 * Gets the current authenticated user from Supabase and syncs with Prisma.
 * Returns null if the user is not authenticated.
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();

    if (error || !authUser) {
      return null;
    }

    return await syncUserFromSupabase(authUser);
  } catch {
    return null;
  }
}

/**
 * Requires a valid authenticated user session.
 * Throws AuthException(401) if not authenticated.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();

  if (!user) {
    throw new AuthException(
      401,
      "UNAUTHORIZED",
      "Authentication required to access this resource"
    );
  }

  return user;
}

/**
 * Requires that the authenticated user has one of the allowed roles.
 * Supports a single role or an array of permitted roles.
 * Role check is strictly performed against the database User record.
 * Throws AuthException(401) if unauthenticated, or AuthException(403) if role doesn't match.
 */
export async function requireRole(allowedRoles: Role | Role[]): Promise<User> {
  const user = await requireUser();

  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  if (!roles.includes(user.role)) {
    throw new AuthException(
      403,
      "FORBIDDEN",
      `Access denied. Requires one of the following roles: ${roles.join(", ")}`
    );
  }

  return user;
}

/**
 * Returns the current user's profile including ownerProfile and roommatePreference.
 */
export async function getCurrentProfile(): Promise<UserProfile> {
  const user = await requireUser();

  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      ownerProfile: true,
      roommatePreference: true,
    },
  });

  if (!fullUser) {
    throw new AuthException(404, "NOT_FOUND", "User profile not found");
  }

  return {
    ...sanitizeUser(fullUser),
    ownerProfile: fullUser.ownerProfile,
    roommatePreference: fullUser.roommatePreference,
  };
}

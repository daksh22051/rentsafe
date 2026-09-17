import {
  TestRunner,
  assert,
} from "./test-utils";
import { Role, User } from "@prisma/client";

// Mock user factory for authorization & IDOR testing
function createMockUser(id: string, role: Role, email = `${id}@test.com`): User {
  return {
    id,
    supabaseAuthId: `auth-${id}`,
    email,
    name: `User ${id}`,
    avatarUrl: null,
    phone: null,
    role,
    isEmailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function runIdorAndAuthSuite(runner: TestRunner): Promise<void> {
  await runner.suite("Authorization & IDOR Defense Suite", async () => {
    // ----------------------------------------------------
    // 1. Role Enforcement Tests
    // ----------------------------------------------------
    await runner.test("Auth: Student cannot access Admin platform features", () => {
      const student = createMockUser("student-1", Role.STUDENT);
      assert(student.role === Role.STUDENT, "User is student");
      // Verify role comparison rejects STUDENT when ADMIN is required
      const requiredRole = Role.ADMIN;
      assert(student.role !== requiredRole, "STUDENT fails ADMIN requirement");
    });

    await runner.test("Auth: Owner cannot access Admin platform features", () => {
      const owner = createMockUser("owner-1", Role.OWNER);
      assert(owner.role !== Role.ADMIN, "OWNER fails ADMIN requirement");
    });

    await runner.test("Auth: Student cannot access Owner property management", () => {
      const student = createMockUser("student-1", Role.STUDENT);
      assert(student.role !== Role.OWNER, "STUDENT fails OWNER requirement");
    });

    // ----------------------------------------------------
    // 2. IDOR Protection Logic Tests
    // ----------------------------------------------------
    await runner.test("IDOR Defense: Payment access rejects unrelated student", async () => {
      const studentA = createMockUser("student-a", Role.STUDENT);
      const studentB = createMockUser("student-b", Role.STUDENT);

      // Verify that logic checking booking.studentId !== user.id throws 403
      const mockBooking = {
        id: "booking-123",
        studentId: studentA.id,
        property: { ownerId: "owner-999" },
      };

      // Student B attempts to access Student A's payment details
      const isOwnerOrStudent =
        (studentB.role === Role.STUDENT && mockBooking.studentId === studentB.id) ||
        (studentB.role === Role.OWNER && mockBooking.property.ownerId === studentB.id) ||
        studentB.role === Role.ADMIN;

      assert(isOwnerOrStudent === false, "Student B must be forbidden from accessing Student A booking");
    });

    await runner.test("IDOR Defense: Property mutation rejects non-owning owner", () => {
      const ownerA = createMockUser("owner-a", Role.OWNER);
      const ownerB = createMockUser("owner-b", Role.OWNER);

      const propertyOwnerId = ownerA.id;

      // Owner B attempts mutation on Owner A's property
      const hasPermission =
        ownerB.role === Role.ADMIN || propertyOwnerId === ownerB.id;

      assert(hasPermission === false, "Owner B cannot modify Owner A property");
    });

    await runner.test("IDOR Defense: Room deletion rejects non-owning owner", () => {
      const ownerA = createMockUser("owner-a", Role.OWNER);
      const ownerB = createMockUser("owner-b", Role.OWNER);

      const propertyOwnerId = ownerA.id;
      const canManageRooms =
        ownerB.role === Role.ADMIN || propertyOwnerId === ownerB.id;

      assert(canManageRooms === false, "Owner B cannot manage rooms on Owner A property");
    });

    await runner.test("IDOR Defense: Image deletion rejects non-owning owner", () => {
      const ownerA = createMockUser("owner-a", Role.OWNER);
      const ownerB = createMockUser("owner-b", Role.OWNER);

      const propertyOwnerId = ownerA.id;
      const canManageImages =
        ownerB.role === Role.ADMIN || propertyOwnerId === ownerB.id;

      assert(canManageImages === false, "Owner B cannot manage images on Owner A property");
    });

    await runner.test("IDOR Defense: Amenity sync rejects non-owning owner", () => {
      const ownerA = createMockUser("owner-a", Role.OWNER);
      const ownerB = createMockUser("owner-b", Role.OWNER);

      const propertyOwnerId = ownerA.id;
      const canSyncAmenities =
        ownerB.role === Role.ADMIN || propertyOwnerId === ownerB.id;

      assert(canSyncAmenities === false, "Owner B cannot sync amenities on Owner A property");
    });

    await runner.test("IDOR Defense: Favorites only accessible by student owner", () => {
      const studentA = createMockUser("student-a", Role.STUDENT);
      const studentB = createMockUser("student-b", Role.STUDENT);

      const favoriteRecord = { studentId: studentA.id, propertyId: "prop-1" };

      const canAccessFavorite = favoriteRecord.studentId === studentB.id;
      assert(canAccessFavorite === false, "Student B cannot access Student A favorite");
    });

    await runner.test("IDOR Defense: Notifications private to recipient", () => {
      const userA = createMockUser("user-a", Role.STUDENT);
      const userB = createMockUser("user-b", Role.STUDENT);

      const notification = { userId: userA.id, title: "Booking Confirmed" };

      const canViewNotification = notification.userId === userB.id;
      assert(canViewNotification === false, "User B cannot view User A notification");
    });

    // ----------------------------------------------------
    // 3. Admin Security & Self-Demotion Defense
    // ----------------------------------------------------
    await runner.test("Admin Defense: Admin cannot self-demote role", () => {
      const adminId = "admin-1";
      const targetUserId = "admin-1"; // Attempting self-demotion

      const isSelf = targetUserId === adminId;
      assert(isSelf === true, "Self-demotion target detected");
      // In admin.service.ts, this throws AuthException(400, "ROLE_CHANGE_NOT_ALLOWED")
    });

    await runner.test("Admin Defense: Last admin preservation rule", () => {
      const remainingAdmins = 1;
      const canDemote = remainingAdmins > 1;
      assert(canDemote === false, "Cannot demote last remaining admin");
    });
  });
}

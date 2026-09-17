import {
  TestRunner,
  assert,
  assertThrows,
} from "./test-utils";
import {
  signUpSchema,
  signInSchema,
  updateProfileSchema,
} from "@/lib/validations/auth";
import {
  createPropertySchema,
  updatePropertySchema,
  propertyQuerySchema,
} from "@/lib/validations/property";
import {
  createRoomSchema,
  updateRoomSchema,
  roomQuerySchema,
} from "@/lib/validations/room";
import {
  syncAmenitiesSchema,
  amenityQuerySchema,
} from "@/lib/validations/amenity";
import {
  createPropertyImageSchema,
  updatePropertyImageSchema,
} from "@/lib/validations/property-image";
import {
  createBookingSchema,
  updateBookingStatusSchema,
} from "@/lib/validations/booking";
import {
  createReviewSchema,
  updateReviewSchema,
} from "@/lib/validations/review";
import {
  createComplaintSchema,
  updateComplaintStatusSchema,
} from "@/lib/validations/complaint";
import { favoriteParamSchema } from "@/lib/validations/favorite";
import { roommatePreferenceSchema } from "@/lib/validations/roommate";
import {
  submitVerificationSchema,
  adminUpdateVerificationSchema,
} from "@/lib/validations/verification";
import { updateUserRoleSchema } from "@/lib/validations/admin";

export async function runValidationSuite(runner: TestRunner): Promise<void> {
  await runner.suite("Validation & Schema Integrity Suite", async () => {
    // ----------------------------------------------------
    // 1. Auth Validations
    // ----------------------------------------------------
    await runner.test("Auth: Valid student signup is accepted", () => {
      const data = signUpSchema.parse({
        email: "student@university.edu",
        password: "StrongPassword123!",
        name: "Alex Johnson",
        role: "STUDENT",
      });
      assert(data.role === "STUDENT", "Role must be STUDENT");
      assert(data.email === "student@university.edu", "Email matches");
    });

    await runner.test("Auth: Valid owner signup is accepted", () => {
      const data = signUpSchema.parse({
        email: "landlord@properties.com",
        password: "OwnerPassword456!",
        name: "Sarah Owner",
        role: "OWNER",
      });
      assert(data.role === "OWNER", "Role must be OWNER");
    });

    await runner.test("Auth: Client cannot self-assign ADMIN role during signup", () => {
      assertThrows(() => {
        signUpSchema.parse({
          email: "hacker@evil.com",
          password: "HackerPassword123!",
          name: "Malicious User",
          role: "ADMIN",
        });
      });
    });

    await runner.test("Auth: Weak password (< 8 chars) is rejected", () => {
      assertThrows(() => {
        signUpSchema.parse({
          email: "test@example.com",
          password: "short",
          name: "Test User",
        });
      });
    });

    await runner.test("Auth: Invalid email format is rejected", () => {
      assertThrows(() => {
        signUpSchema.parse({
          email: "not-an-email",
          password: "ValidPassword123!",
          name: "Test User",
        });
      });
    });

    await runner.test("Auth: Unexpected fields are rejected by strict schema", () => {
      assertThrows(() => {
        signUpSchema.parse({
          email: "test@example.com",
          password: "ValidPassword123!",
          name: "Test User",
          extraField: "exploit",
        });
      });
    });

    // ----------------------------------------------------
    // 2. Property Validations
    // ----------------------------------------------------
    await runner.test("Property: Valid property creation payload passes", () => {
      const payload = {
        title: "Sunset Student Living",
        description: "Cozy and quiet student residence near main campus.",
        propertyType: "APARTMENT",
        address: "123 University Ave",
        city: "Pune",
        state: "Maharashtra",
        pincode: "411007",
        latitude: 18.5204,
        longitude: 73.8567,
        rent: 12000,
        securityDeposit: 24000,
        furnishedStatus: "SEMI_FURNISHED",
      };
      const parsed = createPropertySchema.parse(payload);
      assert(parsed.rent === 12000, "Rent parsed correctly");
    });

    await runner.test("Property: Negative rent is rejected", () => {
      assertThrows(() => {
        createPropertySchema.parse({
          title: "Sunset Student Living",
          description: "Cozy and quiet student residence near main campus.",
          propertyType: "APARTMENT",
          address: "123 University Ave",
          city: "Pune",
          state: "Maharashtra",
          pincode: "411007",
          latitude: 18.5204,
          longitude: 73.8567,
          rent: -5000, // Invalid negative rent
          securityDeposit: 10000,
        });
      });
    });

    await runner.test("Property: Discovery query filters parse correctly", () => {
      const query = propertyQuerySchema.parse({
        city: "Pune",
        roomType: "SINGLE",
        roomAvailable: "true",
        limit: "25",
        page: "2",
      });
      assert(query.city === "Pune", "City query parsed");
      assert(query.roomType === "SINGLE", "RoomType query parsed");
      assert(query.roomAvailable === true, "Room availability coerced");
      assert(query.limit === 25, "Limit coerced");
      assert(query.page === 2, "Page coerced");
    });

    // ----------------------------------------------------
    // 3. Room Validations
    // ----------------------------------------------------
    await runner.test("Room: Valid room payload passes", () => {
      const room = createRoomSchema.parse({
        roomNumber: "A-101",
        roomType: "DOUBLE_SHARING",
        rent: 8500,
        securityDeposit: 17000,
        capacity: 2,
        currentOccupancy: 1,
        hasAttachedBathroom: true,
        hasAc: true,
      });
      assert(room.capacity === 2, "Capacity parsed");
      assert(room.currentOccupancy === 1, "Occupancy parsed");
    });

    await runner.test("Room: Impossible occupancy (occupancy > capacity) is rejected", () => {
      assertThrows(() => {
        createRoomSchema.parse({
          roomNumber: "B-202",
          roomType: "SINGLE",
          rent: 10000,
          capacity: 1,
          currentOccupancy: 3, // Impossible occupancy!
        });
      });
    });

    await runner.test("Room: Zero capacity is rejected", () => {
      assertThrows(() => {
        createRoomSchema.parse({
          roomType: "SINGLE",
          rent: 8000,
          capacity: 0,
        });
      });
    });

    // ----------------------------------------------------
    // 4. Amenity Validations
    // ----------------------------------------------------
    await runner.test("Amenity: Valid amenity UUIDs array parses", () => {
      const valid = syncAmenitiesSchema.parse({
        amenityIds: [
          "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
        ],
      });
      assert(valid.amenityIds.length === 2, "2 IDs parsed");
    });

    await runner.test("Amenity: Malformed UUID is rejected", () => {
      assertThrows(() => {
        syncAmenitiesSchema.parse({
          amenityIds: ["not-a-valid-uuid"],
        });
      });
    });

    // ----------------------------------------------------
    // 5. Property Image Validations
    // ----------------------------------------------------
    await runner.test("Image: Valid image URL metadata is accepted", () => {
      const img = createPropertyImageSchema.parse({
        url: "https://images.unsplash.com/photo-1555854877-bab0e564b8d5",
        caption: "Spacious Balcony View",
        displayOrder: 1,
        isCover: true,
      });
      assert(img.isCover === true, "Cover flag set");
      assert(img.displayOrder === 1, "Display order set");
    });

    await runner.test("Image: Invalid non-URL string is rejected", () => {
      assertThrows(() => {
        createPropertyImageSchema.parse({
          url: "javascript:alert('xss')", // Malicious pseudo-URL
        });
      });
    });

    await runner.test("Image: Local filesystem path is rejected", () => {
      assertThrows(() => {
        createPropertyImageSchema.parse({
          url: "/etc/passwd", // Local path
        });
      });
    });

    // ----------------------------------------------------
    // 6. Booking Validations
    // ----------------------------------------------------
    await runner.test("Booking: Valid booking creation payload passes", () => {
      const booking = createBookingSchema.parse({
        propertyId: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33",
        moveInDate: "2026-10-01T00:00:00.000Z",
        moveOutDate: "2027-04-01T00:00:00.000Z",
        specialRequests: "Quiet floor preferred",
      });
      assert(booking.propertyId.length > 0, "Property ID parsed");
    });

    await runner.test("Booking: Client cannot supply financial amounts in booking creation", () => {
      assertThrows(() => {
        createBookingSchema.parse({
          propertyId: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33",
          moveInDate: "2026-10-01T00:00:00.000Z",
          rentAmount: 1, // Malicious client attempt to set 1 rupee rent!
        });
      });
    });

    // ----------------------------------------------------
    // 7. Review Validations
    // ----------------------------------------------------
    await runner.test("Review: Valid review with ratings between 1 and 5 passes", () => {
      const review = createReviewSchema.parse({
        cleanlinessRating: 4,
        locationRating: 4,
        valueRating: 5,
        ownerRating: 5,
        comment: "Outstanding student accommodation with great amenities.",
      });
      assert(review.valueRating === 5, "Value rating 5");
    });

    await runner.test("Review: Out-of-bounds rating (> 5) is rejected", () => {
      assertThrows(() => {
        createReviewSchema.parse({
          cleanlinessRating: 6, // Invalid: exceeds max 5
          locationRating: 4,
          valueRating: 5,
          comment: "Too good to be true",
        });
      });
    });

    await runner.test("Review: Out-of-bounds rating (< 1) is rejected", () => {
      assertThrows(() => {
        createReviewSchema.parse({
          cleanlinessRating: 0, // Invalid: below min 1
          locationRating: 4,
          valueRating: 5,
          comment: "Terrible stay experience",
        });
      });
    });

    // ----------------------------------------------------
    // 8. Complaint Validations
    // ----------------------------------------------------
    await runner.test("Complaint: Valid complaint payload passes", () => {
      const comp = createComplaintSchema.parse({
        propertyId: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44",
        complaintType: "MAINTENANCE_ISSUE",
        description: "Geyser is not turning on since yesterday evening in the washroom.",
      });
      assert(comp.complaintType === "MAINTENANCE_ISSUE", "Type matches");
    });

    await runner.test("Complaint: Invalid complaintType enum is rejected", () => {
      assertThrows(() => {
        createComplaintSchema.parse({
          propertyId: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44",
          complaintType: "FAKE_TYPE",
          description: "Some detailed description that is long enough.",
        });
      });
    });

    // ----------------------------------------------------
    // 9. Roommate Preference Validations
    // ----------------------------------------------------
    await runner.test("Roommate: Valid roommate preference with minBudget <= maxBudget passes", () => {
      const pref = roommatePreferenceSchema.parse({
        minBudget: 8000,
        maxBudget: 15000,
        preferredCity: "Bengaluru",
        sleepSchedule: "EARLY_BIRD",
        foodPreference: "VEGETARIAN",
        smokingAllowed: false,
        drinkingAllowed: false,
      });
      assert(pref.minBudget === 8000, "Min budget parsed");
      assert(pref.maxBudget === 15000, "Max budget parsed");
    });

    await runner.test("Roommate: Inverted budget (minBudget > maxBudget) is rejected", () => {
      assertThrows(() => {
        roommatePreferenceSchema.parse({
          minBudget: 20000,
          maxBudget: 10000, // Invalid: max < min
          preferredCity: "Bengaluru",
        });
      });
    });

    // ----------------------------------------------------
    // 10. Verification Validations
    // ----------------------------------------------------
    await runner.test("Verification: Rejection requires rejectionReason", () => {
      assertThrows(() => {
        adminUpdateVerificationSchema.parse({
          status: "REJECTED",
          // Missing rejectionReason!
        });
      });
    });

    await runner.test("Verification: Rejection with reason is accepted", () => {
      const rev = adminUpdateVerificationSchema.parse({
        status: "REJECTED",
        rejectionReason: "Electricity bill document is illegible. Please upload clear scan.",
      });
      assert(rev.status === "REJECTED", "Rejected status parsed");
    });

    // ----------------------------------------------------
    // 11. Additional Mutation & Query Validations
    // ----------------------------------------------------
    await runner.test("Auth: Valid signin payload parses", () => {
      const creds = signInSchema.parse({
        email: "user@test.com",
        password: "MyPassword123",
      });
      assert(creds.email === "user@test.com", "Email parsed");
    });

    await runner.test("Auth: Profile update avatarUrl must be a valid URL", () => {
      assertThrows(() => {
        updateProfileSchema.parse({
          avatarUrl: "invalid-url",
        });
      });
    });

    await runner.test("Room: Room update impossible occupancy rejected", () => {
      assertThrows(() => {
        updateRoomSchema.parse({
          capacity: 1,
          currentOccupancy: 2,
        });
      });
    });

    await runner.test("Room: Room query filters coerce availability boolean", () => {
      const q = roomQuerySchema.parse({ isAvailable: "false" });
      assert(q.isAvailable === false, "isAvailable false coerced");
    });

    await runner.test("Amenity: Query parses category parameter", () => {
      const q = amenityQuerySchema.parse({ category: "Essentials" });
      assert(q.category === "Essentials", "Category parsed");
    });

    await runner.test("Image: Update image displayOrder must be non-negative", () => {
      assertThrows(() => {
        updatePropertyImageSchema.parse({
          displayOrder: -1,
        });
      });
    });

    await runner.test("Booking: Update booking status accepts valid BookingStatus", () => {
      const update = updateBookingStatusSchema.parse({
        status: "CONFIRMED",
      });
      assert(update.status === "CONFIRMED", "Confirmed status parsed");
    });

    await runner.test("Review: Partial review update validates rating bounds", () => {
      assertThrows(() => {
        updateReviewSchema.parse({
          cleanlinessRating: 7, // Out of bounds
        });
      });
    });

    await runner.test("Complaint: Status update accepts RESOLVED", () => {
      const comp = updateComplaintStatusSchema.parse({
        status: "RESOLVED",
        adminNotes: "Plumbing contractor fixed the issue.",
      });
      assert(comp.status === "RESOLVED", "Resolved status parsed");
    });

    await runner.test("Favorite: Parameter schema requires valid UUID", () => {
      assertThrows(() => {
        favoriteParamSchema.parse({
          propertyId: "not-a-uuid",
        });
      });
    });

    await runner.test("Verification: Owner submission requires valid documentType", () => {
      const sub = submitVerificationSchema.parse({
        propertyId: "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55",
        documentType: "ELECTRICITY_BILL",
        documentUrl: "https://docs.rentsafe.org/bill.pdf",
      });
      assert(sub.documentType === "ELECTRICITY_BILL", "Document type parsed");
    });

    // ----------------------------------------------------
    // 12. Mass Assignment Fuzzing on Mutations
    // ----------------------------------------------------
    await runner.test("Mass Assignment: Injected id / protected fields rejected in Property mutation", () => {
      assertThrows(() => {
        updatePropertySchema.parse({
          id: "fake-id",
          ownerId: "hacker-user-id",
          verificationStatus: "VERIFIED",
          trustScore: 99.9,
          rent: 15000,
        });
      });
    });

    await runner.test("Mass Assignment: Injected role / permissions rejected in Admin mutation", () => {
      assertThrows(() => {
        updateUserRoleSchema.parse({
          role: "STUDENT",
          isSuperAdmin: true, // Injected privilege field
        });
      });
    });
  });
}

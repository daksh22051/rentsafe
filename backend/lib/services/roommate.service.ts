import { prisma } from "@/lib/prisma";
import { AuthException } from "@/lib/api-response";
import {
  RoommatePreferenceInput,
  RoommateMatchesQueryInput,
} from "@/lib/validations/roommate";
import { RoommatePreference, Prisma } from "@prisma/client";

export interface RoommateCandidateMatch {
  user: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  };
  compatibilityScore: number;
  matchingSummary: string[];
}

/**
 * Retrieves the authenticated student's own roommate preference profile.
 */
export async function getMyPreferences(userId: string) {
  const preference = await prisma.roommatePreference.findUnique({
    where: { userId },
  });

  if (!preference) {
    throw new AuthException(
      404,
      "ROOMMATE_PREFERENCES_NOT_FOUND",
      "Roommate preferences not found. Please configure your preferences first."
    );
  }

  return preference;
}

/**
 * Creates or updates (upserts) the authenticated student's roommate preference profile.
 * Distinguishes whether the record was created or updated for appropriate HTTP status.
 */
export async function upsertPreferences(
  userId: string,
  input: RoommatePreferenceInput
) {
  const existing = await prisma.roommatePreference.findUnique({
    where: { userId },
  });

  const preferenceData: Prisma.RoommatePreferenceCreateInput = {
    user: { connect: { id: userId } },
    minBudget: input.minBudget !== undefined ? new Prisma.Decimal(input.minBudget) : null,
    maxBudget: input.maxBudget !== undefined ? new Prisma.Decimal(input.maxBudget) : null,
    preferredCity: input.preferredCity ?? null,
    preferredLocations: input.preferredLocations ?? [],
    sleepSchedule: input.sleepSchedule ?? null,
    foodPreference: input.foodPreference ?? null,
    studyHabits: input.studyHabits ?? null,
    lifestyle: input.lifestyle ?? null,
    smokingAllowed: input.smokingAllowed,
    drinkingAllowed: input.drinkingAllowed,
    petsAllowed: input.petsAllowed,
    genderPreference: input.genderPreference ?? null,
    bio: input.bio ?? null,
    isActive: input.isActive,
  };

  if (existing) {
    const updated = await prisma.roommatePreference.update({
      where: { userId },
      data: {
        minBudget: input.minBudget !== undefined ? new Prisma.Decimal(input.minBudget) : null,
        maxBudget: input.maxBudget !== undefined ? new Prisma.Decimal(input.maxBudget) : null,
        preferredCity: input.preferredCity ?? null,
        preferredLocations: input.preferredLocations ?? [],
        sleepSchedule: input.sleepSchedule ?? null,
        foodPreference: input.foodPreference ?? null,
        studyHabits: input.studyHabits ?? null,
        lifestyle: input.lifestyle ?? null,
        smokingAllowed: input.smokingAllowed,
        drinkingAllowed: input.drinkingAllowed,
        petsAllowed: input.petsAllowed,
        genderPreference: input.genderPreference ?? null,
        bio: input.bio ?? null,
        isActive: input.isActive,
      },
    });

    return { preference: updated, isNew: false };
  }

  const created = await prisma.roommatePreference.create({
    data: preferenceData,
  });

  return { preference: created, isNew: true };
}

/**
 * Deletes the authenticated student's roommate preference profile.
 */
export async function deleteMyPreferences(userId: string) {
  const existing = await prisma.roommatePreference.findUnique({
    where: { userId },
  });

  if (!existing) {
    throw new AuthException(
      404,
      "ROOMMATE_PREFERENCES_NOT_FOUND",
      "Roommate preferences not found"
    );
  }

  await prisma.roommatePreference.delete({
    where: { userId },
  });

  return { message: "Roommate preferences deleted successfully" };
}

/**
 * Deterministically calculates a 0-100 compatibility score between two preference profiles
 * using strictly the actual fields defined in the RoommatePreference model.
 */
function calculateCompatibility(
  myPref: RoommatePreference,
  candPref: RoommatePreference
): { score: number; summary: string[] } {
  let score = 0;
  const summary: string[] = [];

  // 1. City match (weight: 20)
  if (myPref.preferredCity && candPref.preferredCity) {
    if (
      myPref.preferredCity.trim().toLowerCase() ===
      candPref.preferredCity.trim().toLowerCase()
    ) {
      score += 20;
      summary.push(`Matching preferred city (${candPref.preferredCity})`);
    }
  } else if (!myPref.preferredCity || !candPref.preferredCity) {
    score += 10; // Neutral/flexible
  }

  // 2. Locations overlap (weight: 15)
  const myLocs = new Set(
    myPref.preferredLocations.map((l) => l.trim().toLowerCase())
  );
  const candLocs = candPref.preferredLocations.map((l) => l.trim().toLowerCase());
  const hasLocOverlap = candLocs.some((l) => myLocs.has(l));

  if (hasLocOverlap) {
    score += 15;
    summary.push("Shared preferred locations");
  } else if (myPref.preferredLocations.length === 0 || candPref.preferredLocations.length === 0) {
    score += 8; // Neutral/unrestricted
  }

  // 3. Budget overlap (weight: 20)
  const myMin = myPref.minBudget ? Number(myPref.minBudget) : 0;
  const myMax = myPref.maxBudget ? Number(myPref.maxBudget) : Infinity;
  const candMin = candPref.minBudget ? Number(candPref.minBudget) : 0;
  const candMax = candPref.maxBudget ? Number(candPref.maxBudget) : Infinity;

  const overlapStart = Math.max(myMin, candMin);
  const overlapEnd = Math.min(myMax, candMax);

  if (overlapStart <= overlapEnd) {
    score += 20;
    summary.push("Compatible budget range");
  } else {
    // Check if within 20% margin
    const gap = overlapStart - overlapEnd;
    const refBudget = myMin || candMin || 5000;
    if (gap / refBudget <= 0.2) {
      score += 10;
      summary.push("Close budget range");
    }
  }

  // 4. Sleep schedule match (weight: 10)
  if (myPref.sleepSchedule && candPref.sleepSchedule) {
    if (
      myPref.sleepSchedule.trim().toLowerCase() ===
      candPref.sleepSchedule.trim().toLowerCase()
    ) {
      score += 10;
      summary.push("Matching sleep schedule");
    }
  } else if (!myPref.sleepSchedule || !candPref.sleepSchedule) {
    score += 5;
  }

  // 5. Food preference match (weight: 10)
  if (myPref.foodPreference && candPref.foodPreference) {
    if (
      myPref.foodPreference.trim().toLowerCase() ===
      candPref.foodPreference.trim().toLowerCase()
    ) {
      score += 10;
      summary.push("Compatible food preferences");
    }
  } else if (!myPref.foodPreference || !candPref.foodPreference) {
    score += 5;
  }

  // 6. Study habits match (weight: 10)
  if (myPref.studyHabits && candPref.studyHabits) {
    if (
      myPref.studyHabits.trim().toLowerCase() ===
      candPref.studyHabits.trim().toLowerCase()
    ) {
      score += 10;
      summary.push("Aligned study habits");
    }
  } else if (!myPref.studyHabits || !candPref.studyHabits) {
    score += 5;
  }

  // 7. Lifestyle match (weight: 5)
  if (myPref.lifestyle && candPref.lifestyle) {
    if (
      myPref.lifestyle.trim().toLowerCase() ===
      candPref.lifestyle.trim().toLowerCase()
    ) {
      score += 5;
      summary.push("Compatible lifestyle");
    }
  } else if (!myPref.lifestyle || !candPref.lifestyle) {
    score += 3;
  }

  // 8. Habits / House Rules (smoking, drinking, pets) (weight: 10)
  let habitScore = 0;
  if (myPref.smokingAllowed === candPref.smokingAllowed) habitScore += 3.33;
  if (myPref.drinkingAllowed === candPref.drinkingAllowed) habitScore += 3.33;
  if (myPref.petsAllowed === candPref.petsAllowed) habitScore += 3.34;

  if (habitScore >= 6.6) {
    summary.push("Aligned house habits (smoking/drinking/pets)");
  }
  score += Math.round(habitScore);

  const finalScore = Math.min(Math.max(Math.round(score), 0), 100);
  return { score: finalScore, summary };
}

/**
 * Finds compatible roommate candidates for the authenticated student.
 * Excludes candidate private preferences; exposes only public profile info and compatibility summary.
 */
export async function getRoommateMatches(
  userId: string,
  query: RoommateMatchesQueryInput
) {
  // 1. Fetch authenticated student's preferences
  const myPref = await prisma.roommatePreference.findUnique({
    where: { userId },
  });

  if (!myPref) {
    throw new AuthException(
      404,
      "ROOMMATE_MATCHES_UNAVAILABLE",
      "Please set up your roommate preferences before searching for matches."
    );
  }

  if (!myPref.isActive) {
    throw new AuthException(
      400,
      "INVALID_ROOMMATE_PREFERENCES",
      "Your roommate preference profile is currently inactive. Please activate it to view matches."
    );
  }

  // 2. Fetch other active candidates
  const candidates = await prisma.roommatePreference.findMany({
    where: {
      userId: { not: userId },
      isActive: true,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
    },
  });

  // 3. Compute compatibility for each candidate
  const scoredCandidates: RoommateCandidateMatch[] = candidates.map((cand) => {
    const { score, summary } = calculateCompatibility(myPref, cand);
    return {
      user: {
        id: cand.user.id,
        name: cand.user.name,
        avatarUrl: cand.user.avatarUrl,
      },
      compatibilityScore: score,
      matchingSummary: summary,
    };
  });

  // 4. Sort descending by compatibility score
  scoredCandidates.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

  // 5. Apply pagination
  const page = query.page || 1;
  const limit = Math.min(query.limit || 20, 50);
  const skip = (page - 1) * limit;
  const paginatedMatches = scoredCandidates.slice(skip, skip + limit);

  return {
    matches: paginatedMatches,
    pagination: {
      page,
      limit,
      total: scoredCandidates.length,
      totalPages: Math.ceil(scoredCandidates.length / limit) || 1,
    },
  };
}

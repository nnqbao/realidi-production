import { api } from "@/convex/_generated/api";
import { convexQueryAuthed } from "@/lib/convex/server";
import { sanitizeSearchQuery } from "@/lib/search/sanitize";
import { getSessionUser } from "@/lib/auth/session";
import type { Mood, Place, PlaceCategory, Profile } from "@/types/database";

export type PlacePageData = {
  place: Place;
  category: PlaceCategory | null;
  mergedIntoSlug: string | null;
  moodProfile: Array<{
    mood: Mood;
    avg: number | null;
    samples: number;
    verifiedSamples: number;
    tier: string;
  }>;
  experienceStats: {
    sampleCount: number;
    verifiedCount: number;
    verifiedRatio: number;
    worthIt: number | null;
    bestContext: string | null;
    bestTime: string | null;
    tier: string;
  } | null;
  crowd: { dominant: string | null; sampleCount: number; tier: string } | null;
  cost: { median: number | null; sampleCount: number; tier: string; currency: string } | null;
  timeStats: {
    sampleCount: number;
    verifiedSampleCount: number;
    weekdayCount: number;
    weekendCount: number;
    morningCount: number;
    afternoonCount: number;
    eveningCount: number;
    nightCount: number;
    favoriteDayType: string | null;
    favoriteTimePeriod: string | null;
    tier: string;
  } | null;
  posts: Array<{
    id: string;
    caption: string | null;
    verificationStatus: string;
    likeCount: number;
    commentCount: number;
    createdAt: string;
    visitContext: string | null;
    author: Profile | null;
    mediaPath: string | null;
  }>;
  saved: boolean;
  beenThere: boolean;
};

export async function getPlaceBySlug(slug: string): Promise<PlacePageData | null> {
  return (await convexQueryAuthed(api.places.bySlug, { slug })) as PlacePageData | null;
}

export async function getSavedPlaces() {
  const session = await getSessionUser().catch(() => null);
  if (!session) return [];
  return await convexQueryAuthed(api.places.saved, {});
}

export async function searchPlaces(query: string) {
  const q = sanitizeSearchQuery(query);
  if (!q) return [];
  return await convexQueryAuthed(api.places.search, { query: q });
}

import { api } from "@/convex/_generated/api";
import { convexQueryAuthed } from "@/lib/convex/server";
import { sanitizeSearchQuery } from "@/lib/search/sanitize";
import { matchLabel, type DiscoveryFilters, type RankingConfig } from "@/lib/ranking";
import type { Mood, Place, PlaceCategory } from "@/types/database";

export type RankedPlaceCard = Place & {
  category: PlaceCategory | null;
  distanceMeters: number | null;
  match: ReturnType<typeof matchLabel>;
  moodScore: number;
  moodTier: string;
  verifiedRatio: number;
  verifiedCount: number;
  experienceCount: number;
  crowd: string | null;
  crowdTier: string;
  typicalSpend: number | null;
  spendTier: string;
  rankingPosition: number;
  reasons: string[];
  bestContext: string | null;
  bestTime: string | null;
  isEditorialPick: boolean;
};

export async function discoverPlaces(filters: DiscoveryFilters): Promise<{
  places: RankedPlaceCard[];
  config: RankingConfig;
}> {
  return (await convexQueryAuthed(api.discovery.discover, {
    moodId: filters.moodId ?? undefined,
    nearLat: filters.nearLat ?? undefined,
    nearLng: filters.nearLng ?? undefined,
    radiusMeters: filters.radiusMeters ?? undefined,
    budgetMax: filters.budgetMax ?? undefined,
    timeMinutes: filters.timeMinutes ?? undefined,
    crowd: filters.crowd ?? undefined,
    visitContext: filters.visitContext ?? undefined,
    categoryId: filters.categoryId ?? undefined,
    styleId: filters.styleId ?? undefined,
    query: filters.query ?? undefined,
  })) as { places: RankedPlaceCard[]; config: RankingConfig };
}

export async function getMoodById(id: string | null): Promise<Mood | null> {
  if (!id) return null;
  return (await convexQueryAuthed(api.catalog.moodById, { id })) as Mood | null;
}

export async function searchMoods(query: string) {
  const q = sanitizeSearchQuery(query);
  if (!q) return [];
  return await convexQueryAuthed(api.catalog.searchMoods, { query: q });
}

export async function searchCategories(query: string) {
  const q = sanitizeSearchQuery(query);
  if (!q) return [];
  return await convexQueryAuthed(api.catalog.searchCategories, { query: q });
}

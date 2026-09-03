import { createServerSupabase } from "@/lib/supabase/server";
import { haversineMeters } from "@/lib/geo";
import { sanitizeSearchQuery } from "@/lib/search/sanitize";
import {
  matchLabel,
  rankPlaces,
  type DiscoveryFilters,
  type PlaceRankingInput,
  type RankingConfig,
} from "@/lib/ranking";
import { getRankingConfig } from "@/features/mood/queries";
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

function countBy(rows: { place_id: string }[] | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows ?? []) {
    out[row.place_id] = (out[row.place_id] ?? 0) + 1;
  }
  return out;
}

export async function discoverPlaces(filters: DiscoveryFilters): Promise<{
  places: RankedPlaceCard[];
  config: RankingConfig;
}> {
  const supabase = await createServerSupabase();
  const config = await getRankingConfig();

  const { data: places } = await supabase
    .from("places")
    .select("*, place_categories(*)")
    .eq("status", "active")
    .in("city", ["TP. Hồ Chí Minh", "Ho Chi Minh City"])
    .order("editorial_score", { ascending: false })
    .limit(80);

  const { data: placeMoods } = await supabase.from("place_moods").select("*");
  const { data: moodStats } = await supabase.from("place_mood_stats").select("*");
  const { data: expStats } = await supabase.from("place_experience_stats").select("*");
  const { data: crowdStats } = await supabase.from("place_crowd_stats").select("*");
  const { data: costStats } = await supabase.from("place_cost_stats").select("*");
  const { data: styles } = await supabase.from("place_styles").select("*");
  const { data: saves } = await supabase.from("saves").select("place_id");
  const { data: claims } = await supabase.from("visit_claims").select("place_id");
  const { data: posts } = await supabase
    .from("experience_posts")
    .select("place_id, published_at, like_count, share_count, verification_status")
    .eq("status", "published")
    .is("deleted_at", null);

  const saveCounts = countBy(saves);
  const beenCounts = countBy(claims);

  const lastByPlace: Record<string, string> = {};
  const likeByPlace: Record<string, number> = {};
  const shareByPlace: Record<string, number> = {};
  const expCount: Record<string, number> = {};
  const verifiedCount: Record<string, number> = {};
  for (const post of posts ?? []) {
    if (!post.place_id) continue;
    expCount[post.place_id] = (expCount[post.place_id] ?? 0) + 1;
    likeByPlace[post.place_id] = (likeByPlace[post.place_id] ?? 0) + (post.like_count ?? 0);
    shareByPlace[post.place_id] = (shareByPlace[post.place_id] ?? 0) + (post.share_count ?? 0);
    if (post.verification_status === "verified") {
      verifiedCount[post.place_id] = (verifiedCount[post.place_id] ?? 0) + 1;
    }
    if (post.published_at && (!lastByPlace[post.place_id] || post.published_at > lastByPlace[post.place_id])) {
      lastByPlace[post.place_id] = post.published_at;
    }
  }

  const inputs: PlaceRankingInput[] = [];
  for (const raw of places ?? []) {
    const p = raw as Place & { place_categories: PlaceCategory | null };
    if (filters.categoryId && p.category_id !== filters.categoryId) continue;
    if (filters.styleId && !(styles ?? []).some((s) => s.place_id === p.id && s.style_id === filters.styleId)) {
      continue;
    }
    if (filters.query) {
      const q = filters.query.toLowerCase();
      const hay = `${p.name} ${p.district ?? ""} ${p.short_description ?? ""}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }
    if (filters.timeMinutes && p.typical_duration_minutes && p.typical_duration_minutes > filters.timeMinutes) {
      continue;
    }
    const cost = (costStats ?? []).find((c) => c.place_id === p.id);
    const spend = cost?.median_spend_per_person ?? p.typical_spend_max;
    if (filters.budgetMax && spend && Number(spend) > filters.budgetMax) continue;
    const crowd = (crowdStats ?? []).find((c) => c.place_id === p.id);
    if (filters.crowd && crowd?.dominant_crowd && crowd.dominant_crowd !== filters.crowd) continue;

    let distance: number | null = null;
    if (filters.nearLat != null && filters.nearLng != null && p.latitude != null && p.longitude != null) {
      distance = haversineMeters(filters.nearLat, filters.nearLng, p.latitude, p.longitude);
      if (filters.radiusMeters && distance > filters.radiusMeters) continue;
    }

    const moodRow = filters.moodId
      ? (placeMoods ?? []).find((m) => m.place_id === p.id && m.mood_id === filters.moodId)
      : null;
    const stats = filters.moodId
      ? (moodStats ?? []).find((m) => m.place_id === p.id && m.mood_id === filters.moodId)
      : null;
    const exp = (expStats ?? []).find((e) => e.place_id === p.id);

    inputs.push({
      id: p.id,
      editorialScore: Number(p.editorial_score),
      adminQualityScore: Number(p.admin_quality_score),
      typicalDurationMinutes: p.typical_duration_minutes,
      typicalSpendMin: p.typical_spend_min,
      typicalSpendMax: p.typical_spend_max,
      priceLevel: p.price_level,
      categoryId: p.category_id,
      latitude: p.latitude,
      longitude: p.longitude,
      lastExperienceAt: lastByPlace[p.id] ?? null,
      saveCount: saveCounts[p.id] ?? 0,
      beenThereCount: beenCounts[p.id] ?? 0,
      shareCount: shareByPlace[p.id] ?? 0,
      likeCount: likeByPlace[p.id] ?? 0,
      verifiedExperienceCount: verifiedCount[p.id] ?? 0,
      experienceCount: expCount[p.id] ?? 0,
      verifiedRatio: Number(exp?.verified_ratio ?? 0),
      mood: filters.moodId
        ? {
            editorialWeight: Number(moodRow?.weight ?? 0),
            avgRating: stats?.avg_rating != null ? Number(stats.avg_rating) : null,
            smoothedRating: stats?.smoothed_rating != null ? Number(stats.smoothed_rating) : null,
            sampleCount: stats?.sample_count ?? 0,
            verifiedSampleCount: stats?.verified_sample_count ?? 0,
          }
        : {
            editorialWeight: Number(p.editorial_score),
            avgRating: null,
            smoothedRating: null,
            sampleCount: 0,
            verifiedSampleCount: 0,
          },
      crowd: crowd?.dominant_crowd ?? null,
      medianSpend: spend != null ? Number(spend) : null,
    });
  }

  const ranked = rankPlaces(inputs, {
    userLat: filters.nearLat,
    userLng: filters.nearLng,
    radiusMeters: filters.radiusMeters ?? 12_000,
    config,
  });

  const byId = new Map((places ?? []).map((p) => [p.id, p as Place & { place_categories: PlaceCategory | null }]));
  const cards: RankedPlaceCard[] = ranked.map((row) => {
    const p = byId.get(row.id)!;
    const cost = (costStats ?? []).find((c) => c.place_id === p.id);
    const crowd = (crowdStats ?? []).find((c) => c.place_id === p.id);
    const exp = (expStats ?? []).find((e) => e.place_id === p.id);
    let distance: number | null = null;
    if (filters.nearLat != null && filters.nearLng != null && p.latitude != null && p.longitude != null) {
      distance = haversineMeters(filters.nearLat, filters.nearLng, p.latitude, p.longitude);
    }
    return {
      ...p,
      category: p.place_categories,
      distanceMeters: distance,
      match: matchLabel(row.ranking.moodTier, row.ranking.moodMatch),
      moodScore: row.ranking.moodMatch,
      verifiedRatio: Number(exp?.verified_ratio ?? 0),
      verifiedCount: verifiedCount[p.id] ?? 0,
      crowd: crowd?.dominant_crowd ?? null,
      crowdTier: crowd?.tier ?? "early_signal",
      typicalSpend: cost?.median_spend_per_person != null ? Number(cost.median_spend_per_person) : p.typical_spend_min,
      spendTier: cost?.tier ?? "early_signal",
      rankingPosition: row.position,
      reasons: row.ranking.reasons,
      moodTier: row.ranking.moodTier,
      experienceCount: expCount[p.id] ?? 0,
      bestContext: exp?.best_visit_context ?? null,
      bestTime: exp?.best_time_period ?? null,
      isEditorialPick: Boolean(p.verified_by_admin) || Number(p.editorial_score) >= 0.84,
    };
  });

  return { places: cards, config };
}

export async function getMoodById(id: string | null): Promise<Mood | null> {
  if (!id) return null;
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("moods").select("*").eq("id", id).maybeSingle();
  return (data as Mood | null) ?? null;
}

export async function searchMoods(query: string) {
  const q = sanitizeSearchQuery(query);
  if (!q) return [];
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("moods")
    .select("id, slug, name_vi, name_en, layer")
    .eq("is_active", true)
    .or(`name_vi.ilike.%${q}%,name_en.ilike.%${q}%,slug.ilike.%${q}%`)
    .limit(12);
  return data ?? [];
}

export async function searchCategories(query: string) {
  const q = sanitizeSearchQuery(query);
  if (!q) return [];
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("place_categories")
    .select("id, slug, name_vi, name_en")
    .eq("is_active", true)
    .or(`name_vi.ilike.%${q}%,name_en.ilike.%${q}%,slug.ilike.%${q}%`)
    .limit(12);
  return data ?? [];
}

import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { mediaSrc } from "@/lib/media";
import { sanitizeSearchQuery } from "@/lib/search/sanitize";
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
  const supabase = await createServerSupabase();
  const { data: place } = await supabase
    .from("places")
    .select("*, place_categories(*)")
    .eq("slug", slug)
    .maybeSingle();
  if (!place) return null;

  if (place.status === "merged" && place.merged_into_place_id) {
    const { data: canonical } = await supabase
      .from("places")
      .select("slug")
      .eq("id", place.merged_into_place_id)
      .maybeSingle();
    return {
      place: place as Place,
      category: (place as { place_categories: PlaceCategory | null }).place_categories,
      mergedIntoSlug: canonical?.slug ?? null,
      moodProfile: [],
      experienceStats: null,
      crowd: null,
      cost: null,
      timeStats: null,
      posts: [],
      saved: false,
      beenThere: false,
    };
  }

  const [{ data: moodStats }, { data: moods }, { data: exp }, { data: crowd }, { data: cost }, { data: timeStats }, { data: posts }] =
    await Promise.all([
      supabase.from("place_mood_stats").select("*").eq("place_id", place.id),
      supabase.from("moods").select("*").eq("is_active", true),
      supabase.from("place_experience_stats").select("*").eq("place_id", place.id).maybeSingle(),
      supabase.from("place_crowd_stats").select("*").eq("place_id", place.id).maybeSingle(),
      supabase.from("place_cost_stats").select("*").eq("place_id", place.id).maybeSingle(),
      supabase.from("place_time_stats").select("*").eq("place_id", place.id).maybeSingle(),
      supabase
        .from("experience_posts")
        .select("*, profiles!experience_posts_author_id_fkey(*), post_media(*)")
        .eq("place_id", place.id)
        .eq("status", "published")
        .is("deleted_at", null)
        .neq("moderation_status", "hidden")
        .order("published_at", { ascending: false })
        .limit(20),
    ]);

  const session = await getSessionUser();
  let saved = false;
  let beenThere = false;
  if (session) {
    const [{ data: saveRow }, { data: claimRow }] = await Promise.all([
      supabase.from("saves").select("id").eq("user_id", session.user.id).eq("place_id", place.id).maybeSingle(),
      supabase
        .from("visit_claims")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("place_id", place.id)
        .maybeSingle(),
    ]);
    saved = Boolean(saveRow);
    beenThere = Boolean(claimRow);
  }

  const moodById = new Map((moods ?? []).map((m) => [m.id, m as Mood]));
  const moodProfile = (moodStats ?? [])
    .map((row) => {
      const mood = moodById.get(row.mood_id);
      if (!mood) return null;
      return {
        mood,
        avg: row.avg_rating != null ? Number(row.avg_rating) : null,
        samples: row.sample_count,
        verifiedSamples: row.verified_sample_count,
        tier: row.tier,
      };
    })
    .filter(Boolean) as PlacePageData["moodProfile"];

  return {
    place: place as Place,
    category: (place as { place_categories: PlaceCategory | null }).place_categories,
    mergedIntoSlug: null,
    moodProfile: moodProfile.sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0)),
    experienceStats: exp
      ? {
          sampleCount: exp.sample_count,
          verifiedCount: exp.verified_sample_count,
          verifiedRatio: Number(exp.verified_ratio),
          worthIt: exp.avg_worth_it != null ? Number(exp.avg_worth_it) : null,
          bestContext: exp.best_visit_context,
          bestTime: exp.best_time_period,
          tier: exp.tier,
        }
      : null,
    crowd: crowd
      ? { dominant: crowd.dominant_crowd, sampleCount: crowd.sample_count, tier: crowd.tier }
      : null,
    cost: cost
      ? {
          median: cost.median_spend_per_person != null ? Number(cost.median_spend_per_person) : null,
          sampleCount: cost.sample_count,
          tier: cost.tier,
          currency: cost.currency,
        }
      : null,
    timeStats: timeStats
      ? {
          sampleCount: timeStats.sample_count,
          verifiedSampleCount: timeStats.verified_sample_count,
          weekdayCount: timeStats.weekday_count,
          weekendCount: timeStats.weekend_count,
          morningCount: timeStats.morning_count,
          afternoonCount: timeStats.afternoon_count,
          eveningCount: timeStats.evening_count,
          nightCount: timeStats.night_count,
          favoriteDayType: timeStats.favorite_day_type,
          favoriteTimePeriod: timeStats.favorite_time_period,
          tier: timeStats.tier,
        }
      : null,
    posts: (posts ?? []).map((p) => {
      const row = p as {
        id: string;
        caption: string | null;
        verification_status: string;
        like_count: number;
        comment_count: number;
        created_at: string;
        visit_context: string | null;
        profiles: Profile | null;
        post_media: { storage_path: string; sort_order: number }[];
      };
      const media = [...(row.post_media ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
      return {
        id: row.id,
        caption: row.caption,
        verificationStatus: row.verification_status,
        likeCount: row.like_count,
        commentCount: row.comment_count,
        createdAt: row.created_at,
        visitContext: row.visit_context,
        author: row.profiles,
        mediaPath: media ? mediaSrc(media.storage_path, "experience-media") : null,
      };
    }),
    saved,
    beenThere,
  };
}

export async function getSavedPlaces() {
  const session = await getSessionUser();
  if (!session) return [];
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("saves")
    .select("created_at, places(*, place_categories(*))")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function searchPlaces(query: string) {
  const q = sanitizeSearchQuery(query);
  if (!q) return [];
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("places")
    .select("*, place_categories(*)")
    .eq("status", "active")
    .or(`name.ilike.%${q}%,district.ilike.%${q}%,short_description.ilike.%${q}%`)
    .limit(30);
  return data ?? [];
}

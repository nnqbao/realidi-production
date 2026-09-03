import { createServerSupabase } from "@/lib/supabase/server";
import { sanitizeSearchQuery } from "@/lib/search/sanitize";
import { getSessionUser } from "@/lib/auth/session";
import { mediaSrc } from "@/lib/media";
import { DEFAULT_FEED_RANKING, rankFeedPosts, explainFeedPost, type FeedPostInput } from "@/lib/feed-ranking";
import { getUserTaste } from "@/lib/signals";
import type { FeedPost } from "./types";
import type { FeedReason, Mood, Place, PlaceCategory, Profile } from "@/types/database";

const PAGE_SIZE = 12;

const POST_SELECT =
  "*, profiles!experience_posts_author_id_fkey(*), places!experience_posts_place_id_fkey(*, place_categories(*)), post_media(*), experience_metrics(*), experience_mood_ratings(*)";

type RawPost = {
  id: string;
  author_id: string;
  post_type?: FeedPost["type"];
  caption: string | null;
  created_at: string;
  published_at: string | null;
  verification_status: string;
  like_count: number;
  comment_count: number;
  share_count: number;
  save_count?: number;
  visit_context: FeedPost["metrics"]["visitContext"];
  area_label?: string | null;
  profiles: (Profile & { suspended_at?: string | null }) | null;
  places: (Place & { place_categories: PlaceCategory | null }) | null;
  post_media: { id: string; media_type: "image" | "video"; storage_path: string; sort_order: number }[] | null;
  experience_metrics: {
    crowd_level: FeedPost["metrics"]["crowd"];
    worth_it: number | null;
    spend_per_person: number | null;
  } | null;
  experience_mood_ratings: { mood_id: string }[] | null;
  community_question_meta?: {
    area_label: string | null;
    budget_max: number | null;
    time_label: string | null;
    crowd_preference: string | null;
  } | null;
};

function formatMedia(path: string, type: "image" | "video") {
  const url = mediaSrc(path, "experience-media") ?? path;
  return { url, thumbnailUrl: type === "video" ? url : url };
}

export async function getFeedRankingConfig() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("feed_ranking_config").select("*").eq("id", "default").maybeSingle();
  if (!data) return DEFAULT_FEED_RANKING;
  return {
    socialAffinityWeight: Number(data.social_affinity_weight),
    contentRelevanceWeight: Number(data.content_relevance_weight),
    recencyWeight: Number(data.recency_weight),
    verifiedWeight: Number(data.verified_weight),
    qualityEngagementWeight: Number(data.quality_engagement_weight),
    moodContextWeight: Number(data.mood_context_weight),
    locationWeight: Number(data.location_weight),
    saveWeight: Number(data.save_weight),
    commentWeight: Number(data.comment_weight),
    shareWeight: Number(data.share_weight),
    likeWeight: Number(data.like_weight),
    recencyHalfLifeHours: Number(data.recency_half_life_hours),
  };
}

export async function getFeedPage(options: {
  type: "for_you" | "following";
  moodId?: string | null;
  cursor?: number;
}): Promise<{ posts: FeedPost[]; nextCursor: number | null; followingEmpty: boolean }> {
  const supabase = await createServerSupabase();
  const session = await getSessionUser().catch(() => null);
  const offset = options.cursor ?? 0;

  const { data: raw, error } = await supabase
    .from("experience_posts")
    .select(POST_SELECT)
    .eq("status", "published")
    .is("deleted_at", null)
    .neq("moderation_status", "hidden")
    .order("published_at", { ascending: false })
    .limit(80);
  if (error) console.error("getFeedPage", error.message);

  const rows = ((raw ?? []) as unknown as RawPost[]).filter((row) => !row.profiles?.suspended_at && !row.profiles?.banned_at && !row.profiles?.deleted_at);
  const moods = await loadMoodMap();

  const followingIds = new Set<string>();
  const likedIds = new Set<string>();
  const savedIds = new Set<string>();
  const savedPlaceIds = new Set<string>();
  const blockedIds = new Set<string>();
  const hiddenIds = new Set<string>();
  if (session) {
    const [{ data: follows }, { data: likes }, { data: saves }, { data: placeSaves }, { data: blocks }, { data: hidden }] = await Promise.all([
      supabase.from("follows").select("following_id").eq("follower_id", session.user.id),
      supabase.from("post_likes").select("post_id").eq("user_id", session.user.id),
      supabase.from("saved_posts").select("post_id").eq("user_id", session.user.id),
      supabase.from("saves").select("place_id").eq("user_id", session.user.id),
      supabase.from("user_blocks").select("blocker_id, blocked_id").or(`blocker_id.eq.${session.user.id},blocked_id.eq.${session.user.id}`),
      supabase.from("user_hidden_posts").select("post_id").eq("user_id", session.user.id),
    ]);
    for (const row of follows ?? []) followingIds.add(row.following_id);
    for (const row of likes ?? []) likedIds.add(row.post_id);
    for (const row of saves ?? []) savedIds.add(row.post_id);
    for (const row of placeSaves ?? []) savedPlaceIds.add(row.place_id);
    for (const row of blocks ?? []) blockedIds.add(row.blocker_id === session.user.id ? row.blocked_id : row.blocker_id);
    for (const row of hidden ?? []) hiddenIds.add(row.post_id);
  }

  const visibleRows = rows.filter((row) => !blockedIds.has(row.author_id) && !hiddenIds.has(row.id));

  const taste = session ? await getUserTaste(session.user.id).catch(() => null) : null;
  const coldStart = followingIds.size === 0;

  if (options.type === "following") {
    const followed = visibleRows.filter((row) => followingIds.has(row.author_id));
    const followingEmpty = followed.length === 0;
    const source = followingEmpty ? visibleRows : followed;
    const mapped = mapPosts(source, followingIds, likedIds, savedIds, moods);
    const page = mapped.slice(offset, offset + PAGE_SIZE);
    return {
      posts: await attachQuestionMeta(page.map((post, i) => ({ ...post, position: offset + i + 1 }))),
      nextCursor: offset + PAGE_SIZE < mapped.length ? offset + PAGE_SIZE : null,
      followingEmpty,
    };
  }

  const publicRows = visibleRows.filter((row) => {
    const visibility = (row as RawPost & { visibility?: string }).visibility;
    return !visibility || visibility === "public";
  });

  const config = await getFeedRankingConfig().catch(() => DEFAULT_FEED_RANKING);
  const inputs: FeedPostInput[] = publicRows.map((r) => {
    const isQuestion = r.post_type === "question";
    const isCommunity = r.post_type === "community";
    const savedPlaceMatch = Boolean(r.places?.id && savedPlaceIds.has(r.places.id));
    const tasteMatch = Boolean(
      (r.places?.id && taste?.places.has(r.places.id)) ||
        (taste?.authors.has(r.author_id)) ||
        (r.experience_mood_ratings ?? []).some((m) => taste?.moods.has(m.mood_id)),
    );
    return {
      id: r.id,
      authorId: r.author_id,
      followsAuthor: followingIds.has(r.author_id),
      likedBefore: likedIds.has(r.id),
      commentedBefore: false,
      savedBefore: savedIds.has(r.id),
      moodMatch: Boolean(options.moodId && (r.experience_mood_ratings ?? []).some((m) => m.mood_id === options.moodId)),
      sameCity: true,
      verified: r.verification_status === "verified",
      publishedAt: r.published_at,
      saveCount: r.save_count ?? 0,
      commentCount: r.comment_count,
      shareCount: r.share_count,
      likeCount: r.like_count,
      editorialBoost:
        (r.verification_status === "verified" ? 0.8 : isQuestion || isCommunity ? 0.62 : 0.45) +
        (coldStart && (r.verification_status === "verified" || isQuestion) ? 0.2 : 0),
      tasteMatch,
      savedPlaceMatch,
      isQuestion,
      isCommunity,
      nearbyPopular: (r.save_count ?? 0) + r.comment_count >= 2,
    };
  });

  const ranked = rankFeedPosts(inputs, { config });
  const byId = new Map(publicRows.map((row) => [row.id, row]));
  const reasonById = new Map(ranked.map((item) => [item.id, explainFeedPost(item)]));
  const ordered = ranked.map((item) => byId.get(item.id)!).filter(Boolean);
  const page = ordered.slice(offset, offset + PAGE_SIZE);
  const posts = mapPosts(page, followingIds, likedIds, savedIds, moods, reasonById).map((post, i) => ({
    ...post,
    position: offset + i + 1,
  }));
  return {
    posts: await attachQuestionMeta(posts),
    nextCursor: offset + PAGE_SIZE < ordered.length ? offset + PAGE_SIZE : null,
    followingEmpty: false,
  };
}

function mapPosts(
  rows: RawPost[],
  followingIds: Set<string>,
  likedIds: Set<string>,
  savedIds: Set<string>,
  moods: Map<string, Mood>,
  reasonById?: Map<string, FeedReason[]>,
): FeedPost[] {
  return rows.map((row, index) => {
    const media = [...(row.post_media ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => ({ id: m.id, type: m.media_type, ...formatMedia(m.storage_path, m.media_type) }));
    if (media.length === 0 && row.places?.cover_image_path) {
      media.push({
        id: "cover",
        type: "image",
        url: row.places.cover_image_path,
        thumbnailUrl: row.places.cover_image_path,
      });
    }
    const moodId = row.experience_mood_ratings?.[0]?.mood_id;
    const mood = moodId ? moods.get(moodId) ?? null : null;
    return {
      id: row.id,
      type: row.post_type ?? "experience",
      caption: row.caption,
      createdAt: row.created_at,
      publishedAt: row.published_at,
      verificationStatus: row.verification_status,
      likeCount: row.like_count,
      commentCount: row.comment_count,
      shareCount: row.share_count,
      saveCount: row.save_count ?? 0,
      liked: likedIds.has(row.id),
      saved: savedIds.has(row.id),
      followingAuthor: followingIds.has(row.author_id),
      author: {
        id: row.profiles?.id ?? row.author_id,
        username: row.profiles?.username ?? "user",
        display_name: row.profiles?.display_name ?? "Traveler",
        avatar_path: row.profiles?.avatar_path ?? null,
      },
      place: row.places
        ? {
            id: row.places.id,
            slug: row.places.slug,
            name: row.places.name,
            district: row.places.district,
            city: row.places.city,
            cover_image_path: row.places.cover_image_path,
            categoryName: row.places.place_categories?.name_vi ?? null,
          }
        : null,
      mood: mood
        ? {
            id: mood.id,
            slug: mood.slug,
            name_vi: mood.name_vi,
            name_en: mood.name_en,
            color_token: mood.color_token,
          }
        : null,
      metrics: {
        crowd: row.experience_metrics?.crowd_level ?? null,
        worthIt: row.experience_metrics?.worth_it ?? null,
        spendPerPerson: row.experience_metrics?.spend_per_person ?? null,
        visitContext: row.visit_context,
      },
      media,
      position: index + 1,
      areaLabel: row.area_label ?? row.community_question_meta?.area_label ?? null,
      reasons: reasonById?.get(row.id) ?? [],
      question: row.community_question_meta
        ? {
            areaLabel: row.community_question_meta.area_label,
            budgetMax: row.community_question_meta.budget_max,
            timeLabel: row.community_question_meta.time_label,
            crowdPreference: row.community_question_meta.crowd_preference,
          }
        : null,
    };
  });
}

async function attachQuestionMeta(posts: FeedPost[]): Promise<FeedPost[]> {
  if (!posts.length) return posts;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("community_question_meta")
    .select("post_id, area_label, budget_max, time_label, crowd_preference")
    .in(
      "post_id",
      posts.map((post) => post.id),
    );
  if (error || !data?.length) return posts;
  const byId = new Map(data.map((row) => [row.post_id, row]));
  return posts.map((post) => {
    const meta = byId.get(post.id);
    if (!meta) return post;
    return {
      ...post,
      areaLabel: post.areaLabel ?? meta.area_label,
      question: {
        areaLabel: meta.area_label,
        budgetMax: meta.budget_max,
        timeLabel: meta.time_label,
        crowdPreference: meta.crowd_preference,
      },
    };
  });
}

async function loadMoodMap() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("moods").select("*").eq("is_active", true);
  return new Map((data ?? []).map((m) => [m.id, m as Mood]));
}

async function viewerSets() {
  const supabase = await createServerSupabase();
  const session = await getSessionUser().catch(() => null);
  const followingIds = new Set<string>();
  const likedIds = new Set<string>();
  const savedIds = new Set<string>();
  if (!session) return { followingIds, likedIds, savedIds };
  const [{ data: follows }, { data: likes }, { data: saves }] = await Promise.all([
    supabase.from("follows").select("following_id").eq("follower_id", session.user.id),
    supabase.from("post_likes").select("post_id").eq("user_id", session.user.id),
    supabase.from("saved_posts").select("post_id").eq("user_id", session.user.id),
  ]);
  for (const row of follows ?? []) followingIds.add(row.following_id);
  for (const row of likes ?? []) likedIds.add(row.post_id);
  for (const row of saves ?? []) savedIds.add(row.post_id);
  return { followingIds, likedIds, savedIds };
}

export async function getFeedPostById(id: string): Promise<FeedPost | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("experience_posts")
    .select(
      POST_SELECT,
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const sets = await viewerSets();
  const moods = await loadMoodMap();
  const mapped = mapPosts([data as unknown as RawPost], sets.followingIds, sets.likedIds, sets.savedIds, moods);
  return (await attachQuestionMeta(mapped))[0] ?? null;
}

export async function getFeedPostsForPlace(placeId: string): Promise<FeedPost[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("experience_posts")
    .select(
      POST_SELECT,
    )
    .eq("place_id", placeId)
    .eq("status", "published")
    .is("deleted_at", null)
    .neq("moderation_status", "hidden")
    .order("published_at", { ascending: false })
    .limit(20);
  const sets = await viewerSets();
  const moods = await loadMoodMap();
  return mapPosts((data ?? []) as unknown as RawPost[], sets.followingIds, sets.likedIds, sets.savedIds, moods);
}

export async function getFeedPostsByAuthor(authorId: string): Promise<FeedPost[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("experience_posts")
    .select(
      POST_SELECT,
    )
    .eq("author_id", authorId)
    .eq("status", "published")
    .is("deleted_at", null)
    .neq("moderation_status", "hidden")
    .order("published_at", { ascending: false })
    .limit(40);
  const sets = await viewerSets();
  const moods = await loadMoodMap();
  return mapPosts((data ?? []) as unknown as RawPost[], sets.followingIds, sets.likedIds, sets.savedIds, moods);
}

export async function getSavedPosts(): Promise<FeedPost[]> {
  const session = await getSessionUser().catch(() => null);
  if (!session) return [];
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("saved_posts")
    .select("post_id, created_at")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });
  const ids = (data ?? []).map((row) => row.post_id);
  if (!ids.length) return [];
  const { data: posts } = await supabase
    .from("experience_posts")
    .select(
      POST_SELECT,
    )
    .in("id", ids);
  const sets = await viewerSets();
  const moods = await loadMoodMap();
  const mapped = mapPosts((posts ?? []) as unknown as RawPost[], sets.followingIds, sets.likedIds, sets.savedIds, moods);
  const order = new Map(ids.map((id, i) => [id, i]));
  return mapped.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export async function getSuggestedPeople(limit = 5) {
  const supabase = await createServerSupabase();
  const session = await getSessionUser().catch(() => null);
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_path, bio, role")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(24);
  const following = new Set<string>();
  if (session) {
    const { data: follows } = await supabase.from("follows").select("following_id").eq("follower_id", session.user.id);
    for (const row of follows ?? []) following.add(row.following_id);
  }
  return (data ?? [])
    .filter(
      (p) =>
        p.id !== session?.user.id &&
        !following.has(p.id) &&
        p.username !== "realidi" &&
        p.role !== "admin" &&
        p.role !== "moderator",
    )
    .slice(0, limit);
}

export async function getTrendingPlaces(limit = 4) {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("places")
    .select("id, slug, name, district, cover_image_path")
    .eq("status", "active")
    .order("editorial_score", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getUnreadNotificationCount() {
  const session = await getSessionUser().catch(() => null);
  if (!session) return 0;
  const supabase = await createServerSupabase();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", session.user.id)
    .is("read_at", null);
  if (error) return 0;
  return count ?? 0;
}

export async function getNotifications() {
  const session = await getSessionUser().catch(() => null);
  if (!session) return [];
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error || !data) return [];
  const actorIds = [...new Set(data.map((row) => row.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, username, display_name, avatar_path").in("id", actorIds)
    : { data: [] };
  const byId = new Map((actors ?? []).map((a) => [a.id, a]));
  return data.map((row) => ({
    ...row,
    profiles: row.actor_id ? byId.get(row.actor_id) ?? null : null,
  }));
}

export async function markNotificationsRead() {
  const session = await getSessionUser().catch(() => null);
  if (!session) return;
  const supabase = await createServerSupabase();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", session.user.id)
    .is("read_at", null);
}

export async function searchPeople(query: string) {
  const q = sanitizeSearchQuery(query);
  if (!q) return [];
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_path, bio, role, last_active_at, last_seen_at, show_activity_status")
    .is("deleted_at", null)
    .not("role", "in", "(admin,moderator)")
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .limit(20);
  return (data ?? []).filter((p) => p.username !== "realidi");
}

export async function searchPosts(query: string): Promise<FeedPost[]> {
  const q = sanitizeSearchQuery(query);
  if (!q) return [];
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("experience_posts")
    .select(
      POST_SELECT,
    )
    .eq("status", "published")
    .is("deleted_at", null)
    .ilike("caption", `%${q}%`)
    .limit(20);
  const sets = await viewerSets();
  const moods = await loadMoodMap();
  return mapPosts((data ?? []) as unknown as RawPost[], sets.followingIds, sets.likedIds, sets.savedIds, moods);
}

export async function getRelatedPosts(post: FeedPost): Promise<FeedPost[]> {
  const supabase = await createServerSupabase();
  let query = supabase
    .from("experience_posts")
    .select(
      POST_SELECT,
    )
    .eq("status", "published")
    .is("deleted_at", null)
    .neq("id", post.id)
    .limit(6);
  if (post.place) query = query.eq("place_id", post.place.id);
  else query = query.eq("author_id", post.author.id);
  const { data } = await query;
  const sets = await viewerSets();
  const moods = await loadMoodMap();
  return mapPosts((data ?? []) as unknown as RawPost[], sets.followingIds, sets.likedIds, sets.savedIds, moods);
}

export async function getAuthorPosts(authorId: string, excludeId: string): Promise<FeedPost[]> {
  const posts = await getFeedPostsByAuthor(authorId);
  return posts.filter((p) => p.id !== excludeId).slice(0, 4);
}

export async function getFollowCounts(userId: string) {
  const supabase = await createServerSupabase();
  const [{ count: followers }, { count: following }] = await Promise.all([
    supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", userId),
    supabase.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", userId),
  ]);
  return { followers: followers ?? 0, following: following ?? 0 };
}

export async function getPlacesLite() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("places").select("id, name, district").eq("status", "active").order("name");
  return (data ?? []) as { id: string; name: string; district: string | null }[];
}

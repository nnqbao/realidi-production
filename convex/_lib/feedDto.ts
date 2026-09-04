import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { optionalIdentity } from "./authz";
import { canModerate } from "./capabilities";
import { toAuthorLite } from "./dtos";

export type ViewerSets = {
  profileId: Id<"profiles"> | null;
  role: Doc<"profiles">["role"] | null;
  followingIds: Set<string>;
  likedIds: Set<string>;
  savedIds: Set<string>;
  savedPlaceIds: Set<string>;
  blockedIds: Set<string>;
  hiddenIds: Set<string>;
  tastePlaces: Set<string>;
  tasteMoods: Set<string>;
  tasteAuthors: Set<string>;
};

export async function loadViewerSets(ctx: QueryCtx): Promise<ViewerSets> {
  const identity = await optionalIdentity(ctx);
  const empty: ViewerSets = {
    profileId: null,
    role: null,
    followingIds: new Set(),
    likedIds: new Set(),
    savedIds: new Set(),
    savedPlaceIds: new Set(),
    blockedIds: new Set(),
    hiddenIds: new Set(),
    tastePlaces: new Set(),
    tasteMoods: new Set(),
    tasteAuthors: new Set(),
  };
  if (identity === null) return empty;

  const profileId = identity.profile._id;
  const [follows, likes, saves, placeSaves, outgoing, incoming, hidden, signals] = await Promise.all([
    ctx.db.query("follows").withIndex("by_follower", (q) => q.eq("follower_id", profileId)).collect(),
    ctx.db.query("post_likes").withIndex("by_user", (q) => q.eq("user_id", profileId)).collect(),
    ctx.db.query("saved_posts").withIndex("by_user_created", (q) => q.eq("user_id", profileId)).collect(),
    ctx.db.query("saves").withIndex("by_user_created", (q) => q.eq("user_id", profileId)).collect(),
    ctx.db.query("user_blocks").withIndex("by_blocker", (q) => q.eq("blocker_id", profileId)).collect(),
    ctx.db.query("user_blocks").withIndex("by_blocked", (q) => q.eq("blocked_id", profileId)).collect(),
    ctx.db.query("user_hidden_posts").withIndex("by_user", (q) => q.eq("user_id", profileId)).collect(),
    ctx.db.query("user_interest_signals").withIndex("by_user_created", (q) => q.eq("user_id", profileId)).take(400),
  ]);

  const since = Date.now() - 45 * 24 * 3600_000;
  const tastePlaces = new Set<string>();
  const tasteMoods = new Set<string>();
  const tasteAuthors = new Set<string>();
  for (const row of signals) {
    if (row.created_at < since || !row.entity_id) continue;
    if (row.entity_type === "place") tastePlaces.add(row.entity_id);
    if (row.entity_type === "mood") tasteMoods.add(row.entity_id);
    if (row.entity_type === "author") tasteAuthors.add(row.entity_id);
  }

  return {
    profileId,
    role: identity.profile.role,
    followingIds: new Set(follows.map((row) => row.following_id)),
    likedIds: new Set(likes.map((row) => row.post_id)),
    savedIds: new Set(saves.map((row) => row.post_id)),
    savedPlaceIds: new Set(placeSaves.map((row) => row.place_id)),
    blockedIds: new Set([
      ...outgoing.map((row) => row.blocked_id),
      ...incoming.map((row) => row.blocker_id),
    ]),
    hiddenIds: new Set(hidden.map((row) => row.post_id)),
    tastePlaces,
    tasteMoods,
    tasteAuthors,
  };
}

export function canSeePost(
  post: Doc<"experience_posts">,
  author: Doc<"profiles"> | null,
  viewer: ViewerSets,
): boolean {
  if (author === null) return false;
  if (author.deleted_at !== undefined || author.banned_at !== undefined) return false;
  if (viewer.blockedIds.has(post.author_id)) return false;
  if (viewer.hiddenIds.has(post._id)) return false;

  const isAuthor = viewer.profileId === post.author_id;
  const isStaff = viewer.role !== null && canModerate(viewer.role);
  if (post.deleted_at !== undefined && !isAuthor && !isStaff) return false;
  if (post.moderation_status === "hidden" && !isAuthor && !isStaff) return false;
  if (post.status !== "published" && !isAuthor && !isStaff) return false;
  if (post.visibility === "public") return true;
  if (post.visibility === "followers") {
    return isAuthor || isStaff || viewer.followingIds.has(post.author_id);
  }
  return isAuthor || isStaff;
}

export async function hydratePosts(
  ctx: QueryCtx,
  posts: Doc<"experience_posts">[],
  viewer: ViewerSets,
  reasonById?: Map<string, string[]>,
) {
  const moods = await ctx.db
    .query("moods")
    .withIndex("by_active_order", (q) => q.eq("is_active", true))
    .collect();
  const moodById = new Map(moods.map((mood) => [mood._id, mood]));
  const out = [];
  for (const [index, post] of posts.entries()) {
    const author = await ctx.db.get(post.author_id);
    if (author === null) continue;
    const place = post.place_id ? await ctx.db.get(post.place_id) : null;
    const category = place?.category_id ? await ctx.db.get(place.category_id) : null;
    const mediaRows = await ctx.db
      .query("post_media")
      .withIndex("by_post_order", (q) => q.eq("post_id", post._id))
      .collect();
    const metrics = await ctx.db
      .query("experience_metrics")
      .withIndex("by_post", (q) => q.eq("experience_post_id", post._id))
      .unique();
    const ratings = await ctx.db
      .query("experience_mood_ratings")
      .withIndex("by_post", (q) => q.eq("experience_post_id", post._id))
      .collect();
    const question = await ctx.db
      .query("community_question_meta")
      .withIndex("by_post", (q) => q.eq("post_id", post._id))
      .unique();
    const mood = ratings[0] ? moodById.get(ratings[0].mood_id) : undefined;
    const media: Array<{
      id: string;
      type: "image" | "video";
      url: string;
      thumbnailUrl: string | null;
    }> = [];
    for (const row of mediaRows) {
      const url = await ctx.storage.getUrl(row.storage_id);
      if (!url) continue;
      const thumb = row.thumbnail_storage_id
        ? await ctx.storage.getUrl(row.thumbnail_storage_id)
        : url;
      media.push({
        id: row._id,
        type: row.media_type,
        url,
        thumbnailUrl: thumb,
      });
    }
    if (media.length === 0 && place?.cover_image_path) {
      media.push({
        id: "cover",
        type: "image",
        url: place.cover_image_path,
        thumbnailUrl: place.cover_image_path,
      });
    }
    out.push({
      id: post._id,
      type: post.post_type,
      caption: post.caption ?? null,
      createdAt: new Date(post.created_at).toISOString(),
      publishedAt: post.published_at !== undefined ? new Date(post.published_at).toISOString() : null,
      verificationStatus: post.verification_status,
      likeCount: post.like_count,
      commentCount: post.comment_count,
      shareCount: post.share_count,
      saveCount: post.save_count,
      liked: viewer.likedIds.has(post._id),
      saved: viewer.savedIds.has(post._id),
      followingAuthor: viewer.followingIds.has(post.author_id),
      author: {
        ...toAuthorLite(author),
        avatar_path:
          author.avatar_storage_id === undefined
            ? null
            : await ctx.storage.getUrl(author.avatar_storage_id),
      },
      place: place
        ? {
            id: place._id,
            slug: place.slug,
            name: place.name,
            district: place.district ?? null,
            city: place.city,
            cover_image_path: place.cover_image_path ?? null,
            categoryName: category?.name_vi ?? null,
          }
        : null,
      mood: mood
        ? {
            id: mood._id,
            slug: mood.slug,
            name_vi: mood.name_vi,
            name_en: mood.name_en,
            color_token: mood.color_token,
          }
        : null,
      metrics: {
        crowd: metrics?.crowd_level ?? null,
        worthIt: metrics?.worth_it ?? null,
        spendPerPerson: metrics?.spend_per_person ?? null,
        visitContext: post.visit_context ?? null,
      },
      media,
      position: index + 1,
      areaLabel: post.area_label ?? question?.area_label ?? null,
      reasons: reasonById?.get(post._id) ?? [],
      question: question
        ? {
            areaLabel: question.area_label ?? null,
            budgetMax: question.budget_max ?? null,
            timeLabel: question.time_label ?? null,
            crowdPreference: question.crowd_preference ?? null,
          }
        : null,
      moodIds: ratings.map((row) => row.mood_id as string),
    });
  }
  return out;
}

export async function postMoodIds(ctx: QueryCtx, postId: Id<"experience_posts">): Promise<string[]> {
  const ratings = await ctx.db
    .query("experience_mood_ratings")
    .withIndex("by_post", (q) => q.eq("experience_post_id", postId))
    .collect();
  return ratings.map((row) => row.mood_id);
}

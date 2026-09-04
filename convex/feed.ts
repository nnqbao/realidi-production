import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { optionalIdentity, requireIdentity } from "./_lib/authz";
import { FEED_CANDIDATE_CEILING, isDiscoverablePlace } from "./_lib/dtos";
import { invariant } from "./_lib/errors";
import { explainFeedPost, rankFeedPosts, type FeedPostInput } from "./_lib/feedRanking";
import { canSeePost, hydratePosts, loadViewerSets } from "./_lib/feedDto";
import { feedRankingConfigFromDoc } from "./catalog";
import { normalizeSearchText } from "./_lib/search";
import { pairKey } from "./_lib/uniqueness";

const DEFAULT_FEED_RANKING = {
  socialAffinityWeight: 0.3,
  contentRelevanceWeight: 0.2,
  recencyWeight: 0.15,
  verifiedWeight: 0.15,
  qualityEngagementWeight: 0.1,
  moodContextWeight: 0.05,
  locationWeight: 0.05,
  saveWeight: 4,
  commentWeight: 3,
  shareWeight: 2,
  likeWeight: 1,
  recencyHalfLifeHours: 36,
};

const PAGE_SIZE = 12;

async function rankingConfig(ctx: QueryCtx) {
  const doc = await ctx.db
    .query("feed_ranking_config")
    .withIndex("by_seed_key", (q) => q.eq("seed_key", "feed-ranking:default"))
    .unique();
  return doc ? feedRankingConfigFromDoc(doc) : DEFAULT_FEED_RANKING;
}

async function publishedCandidates(ctx: QueryCtx): Promise<Doc<"experience_posts">[]> {
  const publicRows = await ctx.db
    .query("experience_posts")
    .withIndex("by_feed", (q) => q.eq("status", "published").eq("visibility", "public"))
    .order("desc")
    .take(FEED_CANDIDATE_CEILING);
  const followerRows = await ctx.db
    .query("experience_posts")
    .withIndex("by_feed", (q) => q.eq("status", "published").eq("visibility", "followers"))
    .order("desc")
    .take(FEED_CANDIDATE_CEILING);
  const byId = new Map<string, Doc<"experience_posts">>();
  for (const row of [...publicRows, ...followerRows]) byId.set(row._id, row);
  const merged = [...byId.values()]
    .sort((a, b) => (b.published_at ?? 0) - (a.published_at ?? 0))
    .slice(0, FEED_CANDIDATE_CEILING);
  invariant(
    merged.length <= FEED_CANDIDATE_CEILING,
    "CANDIDATE_LIMIT_EXCEEDED",
    "Feed candidate set exceeds the documented ceiling",
  );
  return merged;
}

async function visiblePosts(
  ctx: QueryCtx,
  posts: Doc<"experience_posts">[],
  viewer: Awaited<ReturnType<typeof loadViewerSets>>,
) {
  const out: Doc<"experience_posts">[] = [];
  for (const post of posts) {
    const author = await ctx.db.get(post.author_id);
    if (canSeePost(post, author, viewer)) out.push(post);
  }
  return out;
}

function toFeedInput(
  post: Doc<"experience_posts">,
  viewer: Awaited<ReturnType<typeof loadViewerSets>>,
  moodIds: string[],
  moodId?: string | null,
): FeedPostInput {
  const isQuestion = post.post_type === "question";
  const isCommunity = post.post_type === "community";
  const coldStart = viewer.followingIds.size === 0;
  return {
    id: post._id,
    followsAuthor: viewer.followingIds.has(post.author_id),
    likedBefore: viewer.likedIds.has(post._id),
    commentedBefore: false,
    savedBefore: viewer.savedIds.has(post._id),
    moodMatch: Boolean(moodId && moodIds.includes(moodId)),
    sameCity: true,
    verified: post.verification_status === "verified",
    publishedAt: post.published_at !== undefined ? new Date(post.published_at).toISOString() : null,
    saveCount: post.save_count,
    commentCount: post.comment_count,
    shareCount: post.share_count,
    likeCount: post.like_count,
    editorialBoost:
      (post.verification_status === "verified" ? 0.8 : isQuestion || isCommunity ? 0.62 : 0.45) +
      (coldStart && (post.verification_status === "verified" || isQuestion) ? 0.2 : 0),
    tasteMatch: Boolean(
      (post.place_id && viewer.tastePlaces.has(post.place_id)) ||
        viewer.tasteAuthors.has(post.author_id) ||
        moodIds.some((id) => viewer.tasteMoods.has(id)),
    ),
    savedPlaceMatch: Boolean(post.place_id && viewer.savedPlaceIds.has(post.place_id)),
    isQuestion,
    isCommunity,
    nearbyPopular: post.save_count + post.comment_count >= 2,
  };
}

export const rankingConfigQuery = query({
  args: {},
  handler: async (ctx) => rankingConfig(ctx),
});

export const page = query({
  args: {
    type: v.union(v.literal("for_you"), v.literal("following")),
    moodId: v.optional(v.string()),
    cursor: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const viewer = await loadViewerSets(ctx);
    const candidates = await publishedCandidates(ctx);
    const visible = await visiblePosts(ctx, candidates, viewer);
    const offset = args.cursor ?? 0;

    if (args.type === "following") {
      const followed = visible.filter((post) => viewer.followingIds.has(post.author_id));
      const followingEmpty = followed.length === 0;
      const source = followingEmpty ? visible : followed;
      const pageRows = source.slice(offset, offset + PAGE_SIZE);
      const posts = await hydratePosts(ctx, pageRows, viewer);
      return {
        posts: posts.map((post, index) => ({ ...post, position: offset + index + 1 })),
        nextCursor: offset + PAGE_SIZE < source.length ? offset + PAGE_SIZE : null,
        followingEmpty,
      };
    }

    const publicRows = visible.filter((post) => post.visibility === "public");
    const config = await rankingConfig(ctx);
    const inputs: FeedPostInput[] = [];
    for (const post of publicRows) {
      const ratings = await ctx.db
        .query("experience_mood_ratings")
        .withIndex("by_post", (q) => q.eq("experience_post_id", post._id))
        .collect();
      inputs.push(toFeedInput(post, viewer, ratings.map((row) => row.mood_id), args.moodId));
    }
    const ranked = rankFeedPosts(inputs, { config });
    const byId = new Map(publicRows.map((row) => [row._id as string, row]));
    const reasonById = new Map(ranked.map((item) => [item.id, explainFeedPost(item)]));
    const ordered = ranked.map((item) => byId.get(item.id)!).filter(Boolean);
    const pageRows = ordered.slice(offset, offset + PAGE_SIZE);
    const posts = await hydratePosts(ctx, pageRows, viewer, reasonById);
    return {
      posts: posts.map((post, index) => ({ ...post, position: offset + index + 1 })),
      nextCursor: offset + PAGE_SIZE < ordered.length ? offset + PAGE_SIZE : null,
      followingEmpty: false,
    };
  },
});

export const byId = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.id as Id<"experience_posts">);
    if (post === null) return null;
    const viewer = await loadViewerSets(ctx);
    const author = await ctx.db.get(post.author_id);
    if (!canSeePost(post, author, viewer)) return null;
    const [hydrated] = await hydratePosts(ctx, [post], viewer);
    return hydrated ?? null;
  },
});

export const forPlace = query({
  args: { placeId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("experience_posts")
      .withIndex("by_place_published", (q) => q.eq("place_id", args.placeId as Id<"places">))
      .order("desc")
      .take(20);
    const viewer = await loadViewerSets(ctx);
    const visible = await visiblePosts(ctx, rows, viewer);
    return await hydratePosts(ctx, visible, viewer);
  },
});

export const byAuthor = query({
  args: { authorId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("experience_posts")
      .withIndex("by_author_created", (q) => q.eq("author_id", args.authorId as Id<"profiles">))
      .order("desc")
      .take(40);
    const viewer = await loadViewerSets(ctx);
    const visible = await visiblePosts(ctx, rows, viewer);
    return await hydratePosts(ctx, visible, viewer);
  },
});

export const saved = query({
  args: {},
  handler: async (ctx) => {
    const identity = await optionalIdentity(ctx);
    if (identity === null) return [];
    const rows = await ctx.db
      .query("saved_posts")
      .withIndex("by_user_created", (q) => q.eq("user_id", identity.profile._id))
      .order("desc")
      .take(80);
    const viewer = await loadViewerSets(ctx);
    const posts: Doc<"experience_posts">[] = [];
    for (const row of rows) {
      const post = await ctx.db.get(row.post_id);
      if (post && canSeePost(post, await ctx.db.get(post.author_id), viewer)) {
        posts.push(post);
      }
    }
    return await hydratePosts(ctx, posts, viewer);
  },
});

export const suggestedPeople = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const viewer = await loadViewerSets(ctx);
    const limit = args.limit ?? 5;
    const profiles = await ctx.db.query("profiles").collect();
    return profiles
      .filter((profile) =>
        profile.deleted_at === undefined &&
        profile.banned_at === undefined &&
        profile._id !== viewer.profileId &&
        !viewer.followingIds.has(profile._id) &&
        profile.username !== "realidi" &&
        profile.role !== "admin" &&
        profile.role !== "moderator" &&
        profile.role !== "owner")
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, limit)
      .map((profile) => ({
        id: profile._id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_path: null as string | null,
        bio: profile.bio ?? null,
        role: profile.role,
      }));
  },
});

export const trendingPlaces = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("places")
      .withIndex("by_city_status", (q) =>
        q.eq("city", "TP. Hồ Chí Minh").eq("status", "active"))
      .take(FEED_CANDIDATE_CEILING);
    return rows
      .filter(isDiscoverablePlace)
      .sort((a, b) => b.editorial_score - a.editorial_score)
      .slice(0, args.limit ?? 4)
      .map((place) => ({
        id: place._id,
        slug: place.slug,
        name: place.name,
        district: place.district ?? null,
        cover_image_path: place.cover_image_path ?? null,
      }));
  },
});

export const related = query({
  args: { postId: v.string() },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId as Id<"experience_posts">);
    if (post === null) return [];
    const viewer = await loadViewerSets(ctx);
    const rows = post.place_id
      ? await ctx.db
          .query("experience_posts")
          .withIndex("by_place_published", (q) => q.eq("place_id", post.place_id!))
          .order("desc")
          .take(12)
      : await ctx.db
          .query("experience_posts")
          .withIndex("by_author_created", (q) => q.eq("author_id", post.author_id))
          .order("desc")
          .take(12);
    const visible = (await visiblePosts(ctx, rows, viewer)).filter((row) => row._id !== post._id);
    return await hydratePosts(ctx, visible.slice(0, 6), viewer);
  },
});

export const authorMore = query({
  args: { authorId: v.string(), excludeId: v.string() },
  handler: async (ctx, args) => {
    const viewer = await loadViewerSets(ctx);
    const rows = await ctx.db
      .query("experience_posts")
      .withIndex("by_author_created", (q) => q.eq("author_id", args.authorId as Id<"profiles">))
      .order("desc")
      .take(12);
    const visible = (await visiblePosts(ctx, rows, viewer)).filter((row) => row._id !== args.excludeId);
    return await hydratePosts(ctx, visible.slice(0, 4), viewer);
  },
});

export const followCounts = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"profiles">;
    const [followers, following] = await Promise.all([
      ctx.db.query("follows").withIndex("by_following", (q) => q.eq("following_id", userId)).collect(),
      ctx.db.query("follows").withIndex("by_follower", (q) => q.eq("follower_id", userId)).collect(),
    ]);
    return { followers: followers.length, following: following.length };
  },
});

export const isFollowing = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const identity = await optionalIdentity(ctx);
    if (identity === null) return false;
    const row = await ctx.db
      .query("follows")
      .withIndex("by_pair", (q) =>
        q.eq("pair_key", pairKey(identity.profile._id, args.userId)))
      .unique();
    return row !== null;
  },
});

export const commentsForPost = query({
  args: { postId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("comments")
      .withIndex("by_post_created", (q) => q.eq("post_id", args.postId as Id<"experience_posts">))
      .collect();
    const items = [];
    for (const row of rows) {
      if (row.deleted_at !== undefined || row.moderation_status === "hidden") continue;
      const author = await ctx.db.get(row.author_id);
      const place = row.place_id ? await ctx.db.get(row.place_id) : null;
      items.push({
        id: row._id,
        body: row.body,
        author_id: row.author_id,
        parent_id: row.parent_id ?? null,
        place_id: row.place_id ?? null,
        profiles: author
          ? { id: author._id, username: author.username, display_name: author.display_name }
          : null,
        attached: place
          ? { id: place._id, slug: place.slug, name: place.name, district: place.district ?? null }
          : null,
      });
    }
    return items;
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const identity = await optionalIdentity(ctx);
    if (identity === null) return 0;
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user_read_created", (q) => q.eq("user_id", identity.profile._id))
      .take(80);
    return rows.filter((row) => row.read_at === undefined).length;
  },
});

export const notifications = query({
  args: {},
  handler: async (ctx) => {
    const identity = await optionalIdentity(ctx);
    if (identity === null) return [];
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user_read_created", (q) => q.eq("user_id", identity.profile._id))
      .order("desc")
      .take(50);
    const out = [];
    for (const row of rows) {
      const actor = row.actor_id ? await ctx.db.get(row.actor_id) : null;
      out.push({
        id: row._id,
        type: row.type,
        post_id: row.post_id ?? null,
        comment_id: row.comment_id ?? null,
        read_at: row.read_at !== undefined ? new Date(row.read_at).toISOString() : null,
        created_at: new Date(row.created_at).toISOString(),
        metadata: row.metadata ?? null,
        profiles: actor
          ? { username: actor.username, display_name: actor.display_name }
          : null,
      });
    }
    return out;
  },
});

export const markNotificationsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireIdentity(ctx);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user_read_created", (q) => q.eq("user_id", profile._id))
      .take(80);
    const now = Date.now();
    for (const row of rows) {
      if (row.read_at === undefined) await ctx.db.patch(row._id, { read_at: now });
    }
  },
});

export const searchPosts = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const needle = normalizeSearchText(args.query);
    if (!needle) return [];
    const viewer = await loadViewerSets(ctx);
    const rows = await publishedCandidates(ctx);
    const matched: Doc<"experience_posts">[] = [];
    for (const post of rows) {
      if (!post.caption || !normalizeSearchText(post.caption).includes(needle)) continue;
      const author = await ctx.db.get(post.author_id);
      if (canSeePost(post, author, viewer)) matched.push(post);
      if (matched.length >= 20) break;
    }
    return await hydratePosts(ctx, matched, viewer);
  },
});

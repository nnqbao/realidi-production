import { api } from "@/convex/_generated/api";
import { convexMutation, convexQueryAuthed } from "@/lib/convex/server";
import { sanitizeSearchQuery } from "@/lib/search/sanitize";
import { getSessionUser } from "@/lib/auth/session";
import { DEFAULT_FEED_RANKING } from "@/lib/feed-ranking";
import type { FeedPost } from "./types";

export async function getFeedRankingConfig() {
  const data = await convexQueryAuthed(api.catalog.feedRankingConfig, {});
  return data ?? DEFAULT_FEED_RANKING;
}

export async function getFeedPage(options: {
  type: "for_you" | "following";
  moodId?: string | null;
  cursor?: number;
}): Promise<{ posts: FeedPost[]; nextCursor: number | null; followingEmpty: boolean }> {
  return (await convexQueryAuthed(api.feed.page, {
    type: options.type,
    moodId: options.moodId ?? undefined,
    cursor: options.cursor,
  })) as { posts: FeedPost[]; nextCursor: number | null; followingEmpty: boolean };
}

export async function getFeedPostById(id: string): Promise<FeedPost | null> {
  return (await convexQueryAuthed(api.feed.byId, { id })) as FeedPost | null;
}

export async function getFeedPostsForPlace(placeId: string): Promise<FeedPost[]> {
  return (await convexQueryAuthed(api.feed.forPlace, { placeId })) as FeedPost[];
}

export async function getFeedPostsByAuthor(authorId: string): Promise<FeedPost[]> {
  return (await convexQueryAuthed(api.feed.byAuthor, { authorId })) as FeedPost[];
}

export async function getSavedPosts(): Promise<FeedPost[]> {
  const session = await getSessionUser().catch(() => null);
  if (!session) return [];
  return (await convexQueryAuthed(api.feed.saved, {})) as FeedPost[];
}

export async function getSuggestedPeople(limit = 5) {
  return await convexQueryAuthed(api.feed.suggestedPeople, { limit });
}

export async function getTrendingPlaces(limit = 4) {
  return await convexQueryAuthed(api.feed.trendingPlaces, { limit });
}

export async function getUnreadNotificationCount() {
  return await convexQueryAuthed(api.feed.unreadCount, {});
}

export async function getNotifications() {
  return await convexQueryAuthed(api.feed.notifications, {});
}

export async function markNotificationsRead() {
  const session = await getSessionUser().catch(() => null);
  if (!session) return;
  await convexMutation(api.feed.markNotificationsRead, {});
}

export async function searchPeople(query: string) {
  const q = sanitizeSearchQuery(query);
  if (!q) return [];
  return await convexQueryAuthed(api.search.people, { query: q });
}

export async function searchPosts(query: string): Promise<FeedPost[]> {
  const q = sanitizeSearchQuery(query);
  if (!q) return [];
  return (await convexQueryAuthed(api.feed.searchPosts, { query: q })) as FeedPost[];
}

export async function getRelatedPosts(post: FeedPost): Promise<FeedPost[]> {
  return (await convexQueryAuthed(api.feed.related, { postId: post.id })) as FeedPost[];
}

export async function getAuthorPosts(authorId: string, excludeId: string): Promise<FeedPost[]> {
  return (await convexQueryAuthed(api.feed.authorMore, { authorId, excludeId })) as FeedPost[];
}

export async function getFollowCounts(userId: string) {
  return await convexQueryAuthed(api.feed.followCounts, { userId });
}

export async function getPlacesLite() {
  return await convexQueryAuthed(api.places.lite, {});
}

export async function getCommentsForPost(postId: string) {
  return await convexQueryAuthed(api.feed.commentsForPost, { postId });
}

export async function isFollowingUser(userId: string) {
  return await convexQueryAuthed(api.feed.isFollowing, { userId });
}

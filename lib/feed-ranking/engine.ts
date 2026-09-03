import { clamp } from "@/lib/utils";
import type { FeedPostInput, FeedRankingConfig } from "./types";
import { DEFAULT_FEED_RANKING } from "./types";

export function feedRecencyScore(publishedAt: string | null, now: Date, halfLifeHours: number): number {
  if (!publishedAt) return 0.2;
  const ageHours = (now.getTime() - new Date(publishedAt).getTime()) / 3_600_000;
  if (ageHours < 0) return 1;
  return Math.pow(0.5, ageHours / halfLifeHours);
}

export function socialAffinityScore(post: FeedPostInput): number {
  let score = 0.12;
  if (post.followsAuthor) score += 0.55;
  if (post.likedBefore) score += 0.12;
  if (post.commentedBefore) score += 0.12;
  if (post.savedBefore) score += 0.09;
  return clamp(score, 0, 1);
}

export function qualityEngagementScore(post: FeedPostInput, config: FeedRankingConfig): number {
  const raw =
    post.saveCount * config.saveWeight +
    post.commentCount * config.commentWeight +
    post.shareCount * config.shareWeight +
    post.likeCount * config.likeWeight;
  return clamp(Math.log(1 + raw) / Math.log(1 + 60), 0, 1);
}

export function scoreFeedPost(
  post: FeedPostInput,
  options: { now?: Date; config?: FeedRankingConfig } = {},
): number {
  const config = options.config ?? DEFAULT_FEED_RANKING;
  const now = options.now ?? new Date();
  const affinity = socialAffinityScore(post);
  const relevance = clamp(
    0.45 +
      (post.moodMatch ? 0.25 : 0) +
      (post.tasteMatch ? 0.18 : 0) +
      (post.savedPlaceMatch ? 0.12 : 0) +
      (post.isQuestion ? 0.08 : 0) +
      post.editorialBoost * 0.3,
    0,
    1,
  );
  const recency = feedRecencyScore(post.publishedAt, now, config.recencyHalfLifeHours);
  const verified = post.verified ? 1 : post.isQuestion || post.isCommunity ? 0.42 : 0.28;
  const engagement = qualityEngagementScore(post, config);
  const mood = post.moodMatch ? 1 : 0.35;
  const location = post.nearbyPopular ? 1 : post.sameCity ? 0.85 : 0.4;
  return (
    config.socialAffinityWeight * affinity +
    config.contentRelevanceWeight * relevance +
    config.recencyWeight * recency +
    config.verifiedWeight * verified +
    config.qualityEngagementWeight * engagement +
    config.moodContextWeight * mood +
    config.locationWeight * location
  );
}

export function rankFeedPosts(posts: FeedPostInput[], options?: Parameters<typeof scoreFeedPost>[1]) {
  return [...posts]
    .map((post) => ({ post, score: scoreFeedPost(post, options) }))
    .sort((a, b) => b.score - a.score)
    .map((row, index) => ({ ...row.post, score: row.score, position: index + 1 }));
}

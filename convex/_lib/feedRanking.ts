export type FeedRankingConfig = {
  socialAffinityWeight: number;
  contentRelevanceWeight: number;
  recencyWeight: number;
  verifiedWeight: number;
  qualityEngagementWeight: number;
  moodContextWeight: number;
  locationWeight: number;
  saveWeight: number;
  commentWeight: number;
  shareWeight: number;
  likeWeight: number;
  recencyHalfLifeHours: number;
};

export type FeedPostInput = {
  id: string;
  publishedAt: string | null;
  followsAuthor: boolean;
  likedBefore: boolean;
  commentedBefore: boolean;
  savedBefore: boolean;
  moodMatch: boolean;
  tasteMatch: boolean;
  savedPlaceMatch: boolean;
  isQuestion: boolean;
  isCommunity: boolean;
  verified: boolean;
  nearbyPopular: boolean;
  sameCity: boolean;
  editorialBoost: number;
  saveCount: number;
  commentCount: number;
  shareCount: number;
  likeCount: number;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

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
  options: { now?: Date; config: FeedRankingConfig },
): number {
  const { config } = options;
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

export function rankFeedPosts(
  posts: FeedPostInput[],
  options: { now?: Date; config: FeedRankingConfig },
) {
  return [...posts]
    .map((post) => ({ post, score: scoreFeedPost(post, options) }))
    .sort((a, b) => b.score - a.score || a.post.id.localeCompare(b.post.id))
    .map((row, index) => ({ ...row.post, score: row.score, position: index + 1 }));
}

export function explainFeedPost(post: FeedPostInput): Array<
  | "FOLLOWED_AUTHOR"
  | "SIMILAR_TO_SAVED_PLACE"
  | "SELECTED_MOOD"
  | "POPULAR_NEARBY"
  | "VERIFIED_EXPERIENCE"
  | "MATCHED_INTEREST"
  | "COMMUNITY_QUESTION"
  | "QUALITY_ENGAGEMENT"
> {
  const reasons: Array<
    | "FOLLOWED_AUTHOR"
    | "SIMILAR_TO_SAVED_PLACE"
    | "SELECTED_MOOD"
    | "POPULAR_NEARBY"
    | "VERIFIED_EXPERIENCE"
    | "MATCHED_INTEREST"
    | "COMMUNITY_QUESTION"
    | "QUALITY_ENGAGEMENT"
  > = [];
  if (post.followsAuthor) reasons.push("FOLLOWED_AUTHOR");
  if (post.moodMatch) reasons.push("SELECTED_MOOD");
  else if (post.tasteMatch) reasons.push("MATCHED_INTEREST");
  if (post.savedPlaceMatch) reasons.push("SIMILAR_TO_SAVED_PLACE");
  if (post.verified) reasons.push("VERIFIED_EXPERIENCE");
  if (post.isQuestion) reasons.push("COMMUNITY_QUESTION");
  if (post.nearbyPopular) reasons.push("POPULAR_NEARBY");
  if (post.saveCount + post.commentCount >= 4) reasons.push("QUALITY_ENGAGEMENT");
  return reasons.slice(0, 2);
}

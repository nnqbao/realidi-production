export type FeedType = "for_you" | "following";

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

export const DEFAULT_FEED_RANKING: FeedRankingConfig = {
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

export type FeedPostInput = {
  id: string;
  authorId: string;
  followsAuthor: boolean;
  likedBefore: boolean;
  commentedBefore: boolean;
  savedBefore: boolean;
  moodMatch: boolean;
  sameCity: boolean;
  verified: boolean;
  publishedAt: string | null;
  saveCount: number;
  commentCount: number;
  shareCount: number;
  likeCount: number;
  editorialBoost: number;
  tasteMatch?: boolean;
  savedPlaceMatch?: boolean;
  isQuestion?: boolean;
  nearbyPopular?: boolean;
  isCommunity?: boolean;
};

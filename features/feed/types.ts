import type { CrowdLevel, Mood, Place, Profile, VisitContext, FeedReason } from "@/types/database";

export type FeedMedia = {
  id: string;
  type: "image" | "video";
  url: string;
  thumbnailUrl: string | null;
};

export type FeedPost = {
  id: string;
  type: "experience" | "check_in" | "photo" | "video" | "community" | "question";
  caption: string | null;
  createdAt: string;
  publishedAt: string | null;
  verificationStatus: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  saveCount: number;
  liked: boolean;
  saved: boolean;
  followingAuthor: boolean;
  author: Pick<Profile, "id" | "username" | "display_name" | "avatar_path">;
  place: Pick<Place, "id" | "slug" | "name" | "district" | "city" | "cover_image_path"> & {
    categoryName: string | null;
  } | null;
  mood: Pick<Mood, "id" | "slug" | "name_vi" | "name_en" | "color_token"> | null;
  metrics: {
    crowd: CrowdLevel | null;
    worthIt: number | null;
    spendPerPerson: number | null;
    visitContext: VisitContext | null;
  };
  media: FeedMedia[];
  position: number;
  areaLabel: string | null;
  reasons: FeedReason[];
  question: {
    areaLabel: string | null;
    budgetMax: number | null;
    timeLabel: string | null;
    crowdPreference: string | null;
  } | null;
};

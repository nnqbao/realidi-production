import type { GenericId } from "convex/values";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = "user" | "creator" | "moderator" | "editor" | "admin" | "owner";
export type MoodLayer = "current_state" | "desired_feeling";
export type PlaceStatus =
  | "active"
  | "pending"
  | "draft"
  | "temporarily_closed"
  | "permanently_closed"
  | "hidden"
  | "merged"
  | "archived";
export type PostStatus = "draft" | "published" | "hidden" | "deleted";
export type VerificationStatus =
  | "unverified"
  | "verification_pending"
  | "verified"
  | "verification_failed";
export type CrowdLevel = "quiet" | "normal" | "busy" | "very_busy";
export type VisitContext = "solo" | "couple" | "friends" | "family" | "work" | "other";
export type ConfidenceTier = "early_signal" | "emerging" | "established";
export type PostType = "experience" | "check_in" | "photo" | "video" | "community" | "question";
export type PostVisibility = "public" | "followers" | "private";
export type NotificationType =
  | "new_follower"
  | "post_like"
  | "post_comment"
  | "comment_reply"
  | "post_saved"
  | "verified_visit"
  | "system"
  | "message"
  | "community_answer"
  | "place_invite";
export type MessageKind = "text" | "post" | "place" | "profile" | "invite" | "image" | "system";
export type InviteStatus = "pending" | "accepted" | "maybe" | "declined";
export type SaveIntent = "saved" | "want_to_go";
export type FeedReason =
  | "FOLLOWED_AUTHOR"
  | "SIMILAR_TO_SAVED_PLACE"
  | "SELECTED_MOOD"
  | "POPULAR_NEARBY"
  | "VERIFIED_EXPERIENCE"
  | "MATCHED_INTEREST"
  | "COMMUNITY_QUESTION"
  | "QUALITY_ENGAGEMENT";

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_path: string | null;
  role: UserRole;
  locale: string;
  timezone: string;
  home_city: string | null;
  onboarding_completed_at: string | null;
  onboarding_skipped_at: string | null;
  last_seen_at: string | null;
  last_active_at: string | null;
  show_activity_status: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  suspended_at: string | null;
  banned_at: string | null;
  ban_reason: string | null;
  suspension_ends_at: string | null;
  deletion_requested_at: string | null;
  warned_at: string | null;
};

export type Mood = {
  id: string;
  slug: string;
  layer: MoodLayer;
  name_vi: string;
  name_en: string;
  description_vi: string | null;
  description_en: string | null;
  prompt_vi: string | null;
  prompt_en: string | null;
  color_token: string;
  icon: string | null;
  is_active: boolean;
  sort_order: number;
};

export type ExperienceStyle = {
  id: string;
  slug: string;
  name_vi: string;
  name_en: string;
  description_vi: string | null;
  description_en: string | null;
  icon: string | null;
  is_active: boolean;
  sort_order: number;
};

export type PlaceCategory = {
  id: string;
  slug: string;
  name_vi: string;
  name_en: string;
  parent_id: string | null;
  icon: string | null;
  typical_duration_minutes: number | null;
  is_active: boolean;
  sort_order: number;
};

export type Place = {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  description: string | null;
  category_id: string | null;
  address: string | null;
  district: string | null;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  cover_image_path: string | null;
  phone: string | null;
  website: string | null;
  opening_hours: Json | null;
  price_level: number | null;
  typical_duration_minutes: number | null;
  typical_spend_min: number | null;
  typical_spend_max: number | null;
  currency: string;
  status: PlaceStatus;
  source: string;
  editorial_score: number;
  admin_quality_score: number;
  verified_by_admin: boolean;
  created_by: string | null;
  merged_into_place_id: string | null;
  seo_title: string | null;
  seo_description: string | null;
  google_maps_url: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SerializedConvexId = string;
export type SerializedDocument<T extends { _id: GenericId<string> }> =
  Omit<T, "_id" | "_creationTime"> & { id: SerializedConvexId };

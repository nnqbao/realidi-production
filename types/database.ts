import type { GenericId } from "convex/values";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Row = Record<string, unknown>;

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

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type TableDef<T extends Row, Rel extends readonly Relationship[] = []> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
  Relationships: Rel;
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<Profile>;
      user_preferences: TableDef<{
        user_id: string;
        preferred_mood_ids: string[];
        preferred_style_ids: string[];
        preferred_visit_contexts: VisitContext[];
        budget_min: number | null;
        budget_max: number | null;
        typical_time_minutes: number | null;
        preferred_crowd: CrowdLevel | null;
        home_latitude: number | null;
        home_longitude: number | null;
      }>;
      moods: TableDef<Mood>;
      experience_styles: TableDef<ExperienceStyle>;
      place_categories: TableDef<PlaceCategory>;
      places: TableDef<
        Place,
        [
          {
            foreignKeyName: "places_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "place_categories";
            referencedColumns: ["id"];
          },
        ]
      >;
      place_moods: TableDef<{
        id: string;
        place_id: string;
        mood_id: string;
        weight: number;
        source: string;
      }>;
      place_styles: TableDef<{ place_id: string; style_id: string }>;
      experience_posts: TableDef<
        {
          id: string;
          author_id: string;
          place_id: string | null;
          post_type: PostType;
          visibility: PostVisibility;
          caption: string | null;
          status: PostStatus;
          visit_date: string | null;
          visit_context: VisitContext | null;
          verification_status: VerificationStatus;
          moderation_status: string;
          like_count: number;
          comment_count: number;
          share_count: number;
          save_count: number;
          published_at: string | null;
          area_label: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        },
        [
          {
            foreignKeyName: "experience_posts_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "experience_posts_place_id_fkey";
            columns: ["place_id"];
            isOneToOne: false;
            referencedRelation: "places";
            referencedColumns: ["id"];
          },
        ]
      >;
      post_media: TableDef<
        {
          id: string;
          post_id: string;
          media_type: "image" | "video";
          storage_path: string;
          thumbnail_path: string | null;
          width: number | null;
          height: number | null;
          duration_seconds: number | null;
          mime_type: string | null;
          sort_order: number;
          processing_status: string;
        },
        [
          {
            foreignKeyName: "post_media_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "experience_posts";
            referencedColumns: ["id"];
          },
        ]
      >;
      experience_mood_ratings: TableDef<
        {
          id: string;
          experience_post_id: string;
          mood_id: string;
          rating: number;
        },
        [
          {
            foreignKeyName: "experience_mood_ratings_post_fkey";
            columns: ["experience_post_id"];
            isOneToOne: false;
            referencedRelation: "experience_posts";
            referencedColumns: ["id"];
          },
        ]
      >;
      experience_metrics: TableDef<
        {
          experience_post_id: string;
          crowd_level: CrowdLevel | null;
          worth_it: number | null;
          spend_per_person: number | null;
          currency: string;
          visit_day_type: string | null;
          visit_time_period: string | null;
        },
        [
          {
            foreignKeyName: "experience_metrics_post_fkey";
            columns: ["experience_post_id"];
            isOneToOne: true;
            referencedRelation: "experience_posts";
            referencedColumns: ["id"];
          },
        ]
      >;
      place_mood_stats: TableDef<{
        place_id: string;
        mood_id: string;
        avg_rating: number | null;
        smoothed_rating: number | null;
        sample_count: number;
        verified_sample_count: number;
        confidence: number;
        tier: ConfidenceTier;
        last_updated: string;
      }>;
      place_experience_stats: TableDef<{
        place_id: string;
        avg_worth_it: number | null;
        smoothed_worth_it: number | null;
        sample_count: number;
        verified_sample_count: number;
        verified_ratio: number;
        confidence: number;
        tier: ConfidenceTier;
        best_visit_context: VisitContext | null;
        best_time_period: string | null;
        last_updated: string;
      }>;
      place_crowd_stats: TableDef<{
        place_id: string;
        quiet_count: number;
        normal_count: number;
        busy_count: number;
        very_busy_count: number;
        dominant_crowd: CrowdLevel | null;
        sample_count: number;
        verified_sample_count: number;
        confidence: number;
        tier: ConfidenceTier;
        last_updated: string;
      }>;
      place_cost_stats: TableDef<{
        place_id: string;
        median_spend_per_person: number | null;
        avg_spend_per_person: number | null;
        currency: string;
        sample_count: number;
        verified_sample_count: number;
        confidence: number;
        tier: ConfidenceTier;
        last_updated: string;
      }>;
      place_time_stats: TableDef<{
        place_id: string;
        weekday_count: number;
        weekend_count: number;
        morning_count: number;
        afternoon_count: number;
        evening_count: number;
        night_count: number;
        favorite_day_type: string | null;
        favorite_time_period: string | null;
        sample_count: number;
        verified_sample_count: number;
        confidence: number;
        tier: ConfidenceTier;
        last_updated: string;
      }>;
      place_recommendation_feedback: TableDef<{
        id: string;
        user_id: string;
        place_id: string;
        mood_id: string | null;
        kind: "fit" | "wrong_mood";
        created_at: string;
      }>;
      saved_collections: TableDef<{
        id: string;
        user_id: string;
        name: string;
        slug: string;
        is_default: boolean;
      }>;
      saves: TableDef<
        {
          id: string;
          user_id: string;
          place_id: string;
          collection_id: string | null;
          intent: SaveIntent;
          created_at: string;
        },
        [
          {
            foreignKeyName: "saves_place_id_fkey";
            columns: ["place_id"];
            isOneToOne: false;
            referencedRelation: "places";
            referencedColumns: ["id"];
          },
        ]
      >;
      visit_claims: TableDef<{
        id: string;
        user_id: string;
        place_id: string;
        claimed_at: string;
      }>;
      visit_verifications: TableDef<
        {
          id: string;
          user_id: string;
          place_id: string;
          experience_post_id: string | null;
          method: string;
          result: string;
          confidence: number;
          distance_meters: number | null;
          accuracy_meters: number | null;
          geofence_radius_meters: number | null;
          verified_at: string | null;
          metadata: Json;
          created_at: string;
        },
        [
          {
            foreignKeyName: "visit_verifications_place_id_fkey";
            columns: ["place_id"];
            isOneToOne: false;
            referencedRelation: "places";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visit_verifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ]
      >;
      saved_posts: TableDef<{
        id: string;
        user_id: string;
        post_id: string;
        created_at: string;
      }>;
      notifications: TableDef<{
        id: string;
        user_id: string;
        actor_id: string | null;
        type: NotificationType;
        post_id: string | null;
        comment_id: string | null;
        read_at: string | null;
        metadata: Json;
        created_at: string;
        idempotency_key: string | null;
      }>;
      feed_ranking_config: TableDef<{
        id: string;
        social_affinity_weight: number;
        content_relevance_weight: number;
        recency_weight: number;
        verified_weight: number;
        quality_engagement_weight: number;
        mood_context_weight: number;
        location_weight: number;
        save_weight: number;
        comment_weight: number;
        share_weight: number;
        like_weight: number;
        recency_half_life_hours: number;
        updated_at: string;
      }>;
      follows: TableDef<{ follower_id: string; following_id: string; created_at: string }>;
      post_likes: TableDef<{ user_id: string; post_id: string; created_at: string }>;
      comments: TableDef<
        {
          id: string;
          post_id: string;
          author_id: string;
          body: string;
          parent_id: string | null;
          place_id: string | null;
          attached_post_id: string | null;
          moderation_status: string;
          created_at: string;
          deleted_at: string | null;
        },
        [
          {
            foreignKeyName: "comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ]
      >;
      shares: TableDef<{
        id: string;
        user_id: string | null;
        place_id: string | null;
        post_id: string | null;
        channel: string;
        created_at: string;
      }>;
      reports: TableDef<{
        id: string;
        reporter_id: string;
        target_type: string;
        target_id: string;
        reason: string;
        details: string | null;
        status: string;
        resolved_by: string | null;
        resolved_at: string | null;
        created_at: string;
        priority: string;
        assigned_to: string | null;
        reviewed_at: string | null;
      }>;
      auth_lockouts: TableDef<{
        email_normalized: string;
        failed_count: number;
        locked_until: string | null;
        updated_at: string;
      }>;
      user_hidden_posts: TableDef<{
        user_id: string;
        post_id: string;
        created_at: string;
      }>;
      place_media: TableDef<{
        id: string;
        place_id: string;
        storage_path: string;
        alt_text: string | null;
        sort_order: number;
        created_by: string | null;
        created_at: string;
      }>;
      audit_logs: TableDef<{
        id: string;
        actor_id: string | null;
        action: string;
        target_type: string;
        target_id: string | null;
        before: Json | null;
        after: Json | null;
        reason: string | null;
        ip: string | null;
        user_agent: string | null;
        correlation_id: string | null;
        created_at: string;
      }>;
      editorial_collections: TableDef<{
        id: string;
        slug: string;
        title: string;
        description: string | null;
        kind: string;
        status: string;
        sort_order: number;
        starts_at: string | null;
        ends_at: string | null;
        created_by: string | null;
        updated_by: string | null;
        created_at: string;
        updated_at: string;
      }>;
      editorial_collection_items: TableDef<{
        id: string;
        collection_id: string;
        target_type: string;
        target_id: string;
        sort_order: number;
      }>;
      featured_placements: TableDef<{
        id: string;
        surface: string;
        target_type: string;
        target_id: string;
        sort_order: number;
        status: string;
        starts_at: string | null;
        ends_at: string | null;
        created_by: string | null;
        updated_by: string | null;
        created_at: string;
        updated_at: string;
      }>;
      moderation_actions: TableDef<
        {
          id: string;
          actor_id: string;
          target_type: string;
          target_id: string;
          action: string;
          reason: string | null;
          metadata: Json;
          created_at: string;
        },
        [
          {
            foreignKeyName: "moderation_actions_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ]
      >;
      ranking_config: TableDef<{
        id: string;
        mood_match_weight: number;
        trust_weight: number;
        freshness_weight: number;
        proximity_weight: number;
        quality_engagement_weight: number;
        bayesian_prior_mean: number;
        bayesian_prior_strength: number;
        save_weight: number;
        been_there_weight: number;
        share_weight: number;
        like_weight: number;
        freshness_half_life_days: number;
        min_samples_early: number;
        min_samples_medium: number;
        editorial_cold_start_weight: number;
        geofence_radius_meters: number;
        updated_at: string;
        updated_by: string | null;
      }>;
      feature_flags: TableDef<{
        key: string;
        enabled: boolean;
        description: string | null;
        updated_by: string | null;
      }>;
      product_events: TableDef<{
        id: string;
        event_name: string;
        user_id: string | null;
        session_id: string | null;
        properties: Json;
        created_at: string;
      }>;
      travel_dna_profiles: TableDef<{
        user_id: string;
        declared: Json;
        behavioral: Json;
        updated_at: string;
      }>;
      creator_reputation: TableDef<{
        user_id: string;
        verified_contribution_count: number;
        useful_save_count: number;
        report_count: number;
      }>;
      community_question_meta: TableDef<{
        post_id: string;
        area_label: string | null;
        budget_max: number | null;
        mood_id: string | null;
        visit_context: VisitContext | null;
        time_label: string | null;
        crowd_preference: CrowdLevel | null;
        created_at: string;
      }>;
      user_interest_signals: TableDef<{
        id: string;
        user_id: string;
        entity_type: string;
        entity_id: string | null;
        signal_type: string;
        weight: number;
        created_at: string;
      }>;
      conversations: TableDef<{
        id: string;
        is_direct: boolean;
        last_message_at: string;
        created_at: string;
      }>;
      conversation_participants: TableDef<{
        conversation_id: string;
        user_id: string;
        last_read_at: string | null;
        muted: boolean;
        joined_at: string;
      }>;
      messages: TableDef<{
        id: string;
        conversation_id: string;
        sender_id: string;
        body: string | null;
        kind: MessageKind;
        payload: Json;
        created_at: string;
        deleted_at: string | null;
        edited_at: string | null;
        client_id: string | null;
        reply_to_message_id: string | null;
      }>;
      conversation_typing: TableDef<{
        conversation_id: string;
        user_id: string;
        typed_at: string;
      }>;
      place_invitations: TableDef<{
        id: string;
        place_id: string;
        from_user_id: string;
        to_user_id: string;
        conversation_id: string | null;
        message_id: string | null;
        suggested_date: string | null;
        suggested_time: string | null;
        note: string | null;
        status: InviteStatus;
        responded_at: string | null;
        created_at: string;
      }>;
      message_reactions: TableDef<{
        message_id: string;
        user_id: string;
        reaction: string;
        created_at: string;
      }>;
      user_blocks: TableDef<{
        blocker_id: string;
        blocked_id: string;
        created_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      nearby_places: {
        Args: {
          p_lat: number;
          p_lng: number;
          p_radius_meters?: number;
          p_limit?: number;
        };
        Returns: { id: string; distance_meters: number }[];
      };
      refresh_place_aggregates: {
        Args: { p_place_id: string };
        Returns: undefined;
      };
      refresh_place_time_stats: {
        Args: { p_place_id: string };
        Returns: undefined;
      };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_staff: { Args: Record<string, never>; Returns: boolean };
      is_conversation_member: { Args: { cid: string }; Returns: boolean };
      get_or_create_dm: { Args: { other_user_id: string }; Returns: string };
      is_blocked_with: { Args: { other: string }; Returns: boolean };
      notify_event: {
        Args: {
          p_user_id: string;
          p_actor_id: string;
          p_type: NotificationType;
          p_post_id?: string | null;
          p_comment_id?: string | null;
          p_idempotency_key?: string | null;
          p_metadata?: Json;
        };
        Returns: string | null;
      };
    };
    Enums: {
      user_role: UserRole;
      mood_layer: MoodLayer;
      place_status: PlaceStatus;
      post_status: PostStatus;
      verification_status: VerificationStatus;
      crowd_level: CrowdLevel;
      visit_context: VisitContext;
      confidence_tier: ConfidenceTier;
      post_type: PostType;
      post_visibility: PostVisibility;
      notification_type: NotificationType;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type DomainTableName = keyof Database["public"]["Tables"];
export type ConvexId<TableName extends DomainTableName> = GenericId<TableName>;
export type SerializedConvexId = string;
export type SerializedDocument<T extends { _id: GenericId<string> }> =
  Omit<T, "_id" | "_creationTime"> & { id: SerializedConvexId };

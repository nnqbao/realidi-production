import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  confidenceTier, crowdLevel, editorialKind, editorialStatus, entityType,
  featuredSurface, feedbackKind, flatJson, invitationStatus, mediaType,
  messageKind, moderationStatus, moderationTargetType, moodLayer,
  notificationType, placeSource, placeStatus, postStatus, postType,
  postVisibility, reaction, reportPriority, reportStatus, reportTargetType,
  saveIntent, userRole, verificationMethod, verificationResult,
  verificationStatus, visitContext, visitDayType, visitTimePeriod,
} from "./validators";

const schema = defineSchema({
  ...authTables,

  profiles: defineTable({
    auth_user_id: v.id("users"), username: v.string(), email_normalized: v.optional(v.string()),
    display_name: v.string(), bio: v.optional(v.string()), avatar_storage_id: v.optional(v.id("_storage")),
    role: userRole, locale: v.string(), timezone: v.string(), home_city: v.optional(v.string()),
    onboarding_completed_at: v.optional(v.number()), onboarding_skipped_at: v.optional(v.number()),
    last_seen_at: v.optional(v.number()), last_active_at: v.optional(v.number()),
    show_activity_status: v.boolean(), must_change_password: v.optional(v.boolean()),
    suspended_at: v.optional(v.number()), suspension_ends_at: v.optional(v.number()),
    banned_at: v.optional(v.number()),
    ban_reason: v.optional(v.string()), deletion_requested_at: v.optional(v.number()),
    warned_at: v.optional(v.number()), created_at: v.number(), updated_at: v.number(),
    deleted_at: v.optional(v.number()), legacy_id: v.optional(v.string()),
  }).index("by_auth_user", ["auth_user_id"]).index("by_username", ["username"])
    .index("by_email", ["email_normalized"]).index("by_role", ["role"])
    .index("by_legacy_id", ["legacy_id"]),

  user_preferences: defineTable({
    user_id: v.id("profiles"), preferred_mood_ids: v.array(v.id("moods")),
    preferred_style_ids: v.array(v.id("experience_styles")),
    preferred_visit_contexts: v.array(visitContext), budget_min: v.optional(v.number()),
    budget_max: v.optional(v.number()), typical_time_minutes: v.optional(v.number()),
    preferred_crowd: v.optional(crowdLevel), home_latitude_e6: v.optional(v.number()),
    home_longitude_e6: v.optional(v.number()), created_at: v.number(), updated_at: v.number(),
  }).index("by_user", ["user_id"]),

  moods: defineTable({
    seed_key: v.optional(v.string()), slug: v.string(), layer: moodLayer, name_vi: v.string(),
    name_en: v.string(), description_vi: v.optional(v.string()),
    description_en: v.optional(v.string()), prompt_vi: v.optional(v.string()),
    prompt_en: v.optional(v.string()), color_token: v.string(), icon: v.optional(v.string()),
    is_active: v.boolean(), sort_order: v.number(), created_at: v.number(), updated_at: v.number(),
  }).index("by_slug", ["slug"]).index("by_seed_key", ["seed_key"])
    .index("by_layer_active_order", ["layer", "is_active", "sort_order"])
    .index("by_active_order", ["is_active", "sort_order"]),

  experience_styles: defineTable({
    seed_key: v.optional(v.string()), slug: v.string(), name_vi: v.string(), name_en: v.string(),
    description_vi: v.optional(v.string()), description_en: v.optional(v.string()),
    icon: v.optional(v.string()), is_active: v.boolean(), sort_order: v.number(),
    created_at: v.number(), updated_at: v.number(),
  }).index("by_slug", ["slug"]).index("by_seed_key", ["seed_key"])
    .index("by_active_order", ["is_active", "sort_order"]),

  place_categories: defineTable({
    seed_key: v.optional(v.string()), slug: v.string(), name_vi: v.string(), name_en: v.string(),
    parent_id: v.optional(v.id("place_categories")), icon: v.optional(v.string()),
    typical_duration_minutes: v.optional(v.number()), is_active: v.boolean(),
    sort_order: v.number(), created_at: v.number(), updated_at: v.number(),
  }).index("by_slug", ["slug"]).index("by_seed_key", ["seed_key"])
    .index("by_parent", ["parent_id"]).index("by_active_order", ["is_active", "sort_order"]),

  places: defineTable({
    seed_key: v.optional(v.string()), legacy_id: v.optional(v.string()), slug: v.string(),
    name: v.string(), normalized_search: v.string(), short_description: v.optional(v.string()),
    description: v.optional(v.string()), category_id: v.optional(v.id("place_categories")),
    address: v.optional(v.string()), district: v.optional(v.string()), city: v.string(),
    country: v.string(), latitude_e6: v.optional(v.number()), longitude_e6: v.optional(v.number()),
    cover_image_path: v.optional(v.string()), phone: v.optional(v.string()),
    website: v.optional(v.string()), opening_hours: v.optional(flatJson),
    price_level: v.optional(v.number()), typical_duration_minutes: v.optional(v.number()),
    typical_spend_min: v.optional(v.number()), typical_spend_max: v.optional(v.number()),
    currency: v.string(), status: placeStatus, source: placeSource,
    external_provider: v.optional(v.string()), external_provider_id: v.optional(v.string()),
    external_provider_key: v.optional(v.string()), created_by: v.optional(v.id("profiles")),
    verified_by_admin: v.boolean(), editorial_score: v.number(), admin_quality_score: v.number(),
    merged_into_place_id: v.optional(v.id("places")), seo_title: v.optional(v.string()),
    seo_description: v.optional(v.string()), google_maps_url: v.optional(v.string()),
    archived_at: v.optional(v.number()), deleted_at: v.optional(v.number()),
    updated_by: v.optional(v.id("profiles")), created_at: v.number(), updated_at: v.number(),
  }).index("by_slug", ["slug"]).index("by_seed_key", ["seed_key"])
    .index("by_legacy_id", ["legacy_id"]).index("by_provider_key", ["external_provider_key"])
    .index("by_status_city", ["status", "city"]).index("by_city_status", ["city", "status"])
    .index("by_category", ["category_id"])
    .searchIndex("search_places", { searchField: "normalized_search", filterFields: ["city", "status"] }),

  place_moods: defineTable({
    seed_key: v.optional(v.string()), place_id: v.id("places"), mood_id: v.id("moods"), pair_key: v.string(),
    weight: v.number(), source: v.string(), created_at: v.number(),
  }).index("by_pair", ["pair_key"]).index("by_seed_key", ["seed_key"])
    .index("by_place", ["place_id"]).index("by_mood", ["mood_id"]),

  place_styles: defineTable({
    seed_key: v.optional(v.string()), place_id: v.id("places"),
    style_id: v.id("experience_styles"), pair_key: v.string(),
    created_at: v.number(),
  }).index("by_pair", ["pair_key"]).index("by_seed_key", ["seed_key"])
    .index("by_place", ["place_id"]).index("by_style", ["style_id"]),

  experience_posts: defineTable({
    author_id: v.id("profiles"), place_id: v.optional(v.id("places")), caption: v.optional(v.string()),
    status: postStatus, post_type: postType, visibility: postVisibility,
    visit_date: v.optional(v.string()), visit_context: v.optional(visitContext),
    verification_status: verificationStatus, moderation_status: moderationStatus,
    area_label: v.optional(v.string()), like_count: v.number(), comment_count: v.number(),
    share_count: v.number(), save_count: v.number(), published_at: v.optional(v.number()),
    created_at: v.number(), updated_at: v.number(), deleted_at: v.optional(v.number()),
    legacy_id: v.optional(v.string()),
  }).index("by_author_created", ["author_id", "created_at"])
    .index("by_place_published", ["place_id", "published_at"])
    .index("by_feed", ["status", "visibility", "published_at"])
    .index("by_verification", ["verification_status"]).index("by_legacy_id", ["legacy_id"]),

  post_media: defineTable({
    post_id: v.id("experience_posts"), storage_id: v.id("_storage"), media_type: mediaType,
    thumbnail_storage_id: v.optional(v.id("_storage")), width: v.optional(v.number()),
    height: v.optional(v.number()), duration_seconds: v.optional(v.number()),
    mime_type: v.string(), file_size_bytes: v.number(), sort_order: v.number(),
    processing_status: v.union(v.literal("ready"), v.literal("failed")),
    created_at: v.number(),
  }).index("by_post_order", ["post_id", "sort_order"]).index("by_storage", ["storage_id"]),

  experience_mood_ratings: defineTable({
    experience_post_id: v.id("experience_posts"), mood_id: v.id("moods"),
    pair_key: v.string(), rating: v.number(), created_at: v.number(),
  }).index("by_pair", ["pair_key"]).index("by_post", ["experience_post_id"])
    .index("by_mood", ["mood_id"]),

  experience_metrics: defineTable({
    experience_post_id: v.id("experience_posts"), crowd_level: v.optional(crowdLevel),
    worth_it: v.optional(v.number()), spend_per_person: v.optional(v.number()),
    currency: v.string(), visit_day_type: v.optional(visitDayType),
    visit_time_period: v.optional(visitTimePeriod), created_at: v.number(), updated_at: v.number(),
  }).index("by_post", ["experience_post_id"]),

  place_mood_stats: defineTable({
    place_id: v.id("places"), mood_id: v.id("moods"), pair_key: v.string(),
    avg_rating: v.optional(v.number()), smoothed_rating: v.optional(v.number()),
    sample_count: v.number(), verified_sample_count: v.number(), confidence: v.number(),
    tier: confidenceTier, last_updated: v.number(),
  }).index("by_pair", ["pair_key"]).index("by_place", ["place_id"]).index("by_mood", ["mood_id"]),

  place_experience_stats: defineTable({
    place_id: v.id("places"), avg_worth_it: v.optional(v.number()),
    smoothed_worth_it: v.optional(v.number()), sample_count: v.number(),
    verified_sample_count: v.number(), verified_ratio: v.number(), confidence: v.number(),
    tier: confidenceTier, best_visit_context: v.optional(visitContext),
    best_time_period: v.optional(visitTimePeriod), last_updated: v.number(),
  }).index("by_place", ["place_id"]),

  place_crowd_stats: defineTable({
    place_id: v.id("places"), quiet_count: v.number(), normal_count: v.number(),
    busy_count: v.number(), very_busy_count: v.number(), dominant_crowd: v.optional(crowdLevel),
    sample_count: v.number(), verified_sample_count: v.number(), confidence: v.number(),
    tier: confidenceTier, last_updated: v.number(),
  }).index("by_place", ["place_id"]),

  place_cost_stats: defineTable({
    place_id: v.id("places"), median_spend_per_person: v.optional(v.number()),
    avg_spend_per_person: v.optional(v.number()), currency: v.string(), sample_count: v.number(),
    verified_sample_count: v.number(), confidence: v.number(), tier: confidenceTier,
    last_updated: v.number(),
  }).index("by_place", ["place_id"]),

  place_time_stats: defineTable({
    place_id: v.id("places"), weekday_count: v.number(), weekend_count: v.number(),
    morning_count: v.number(), afternoon_count: v.number(), evening_count: v.number(),
    night_count: v.number(), favorite_day_type: v.optional(visitDayType),
    favorite_time_period: v.optional(visitTimePeriod), sample_count: v.number(),
    verified_sample_count: v.number(), confidence: v.number(), tier: confidenceTier,
    last_updated: v.number(),
  }).index("by_place", ["place_id"]),

  travel_dna_profiles: defineTable({
    user_id: v.id("profiles"), declared: flatJson, behavioral: flatJson, updated_at: v.number(),
  }).index("by_user", ["user_id"]),

  creator_reputation: defineTable({
    user_id: v.id("profiles"), verified_contribution_count: v.number(),
    useful_save_count: v.number(), report_count: v.number(), updated_at: v.number(),
  }).index("by_user", ["user_id"]),

  saved_collections: defineTable({
    user_id: v.id("profiles"), name: v.string(), slug: v.string(), user_slug_key: v.string(),
    is_default: v.boolean(), created_at: v.number(), updated_at: v.number(),
  }).index("by_user_slug", ["user_slug_key"]).index("by_user", ["user_id"]),

  saves: defineTable({
    user_id: v.id("profiles"), place_id: v.id("places"),
    collection_id: v.optional(v.id("saved_collections")), unique_key: v.string(),
    intent: saveIntent, created_at: v.number(),
  }).index("by_unique_key", ["unique_key"]).index("by_user_created", ["user_id", "created_at"])
    .index("by_place", ["place_id"]).index("by_collection", ["collection_id"]),

  visit_claims: defineTable({
    user_id: v.id("profiles"), place_id: v.id("places"), pair_key: v.string(), claimed_at: v.number(),
  }).index("by_pair", ["pair_key"]).index("by_user", ["user_id"]).index("by_place", ["place_id"]),

  visit_verifications: defineTable({
    user_id: v.id("profiles"), place_id: v.id("places"),
    experience_post_id: v.optional(v.id("experience_posts")), method: verificationMethod,
    result: verificationResult, confidence: v.number(), distance_meters: v.optional(v.number()),
    accuracy_meters: v.optional(v.number()), geofence_radius_meters: v.optional(v.number()),
    verified_at: v.optional(v.number()), metadata: flatJson, created_at: v.number(),
  }).index("by_place_created", ["place_id", "created_at"])
    .index("by_user_created", ["user_id", "created_at"]).index("by_post", ["experience_post_id"]),

  follows: defineTable({
    follower_id: v.id("profiles"), following_id: v.id("profiles"),
    pair_key: v.string(), created_at: v.number(),
  }).index("by_pair", ["pair_key"]).index("by_follower", ["follower_id"])
    .index("by_following", ["following_id"]),

  post_likes: defineTable({
    user_id: v.id("profiles"), post_id: v.id("experience_posts"),
    pair_key: v.string(), created_at: v.number(),
  }).index("by_pair", ["pair_key"]).index("by_user", ["user_id"]).index("by_post", ["post_id"]),

  comments: defineTable({
    post_id: v.id("experience_posts"), author_id: v.id("profiles"), body: v.string(),
    parent_id: v.optional(v.id("comments")), place_id: v.optional(v.id("places")),
    attached_post_id: v.optional(v.id("experience_posts")), moderation_status: moderationStatus,
    created_at: v.number(), updated_at: v.number(), deleted_at: v.optional(v.number()),
  }).index("by_post_created", ["post_id", "created_at"]).index("by_author", ["author_id"])
    .index("by_parent", ["parent_id"]).index("by_place", ["place_id"]),

  shares: defineTable({
    user_id: v.optional(v.id("profiles")), place_id: v.optional(v.id("places")),
    post_id: v.optional(v.id("experience_posts")), channel: v.string(), created_at: v.number(),
  }).index("by_user_created", ["user_id", "created_at"]).index("by_place", ["place_id"])
    .index("by_post", ["post_id"]),

  reports: defineTable({
    reporter_id: v.id("profiles"), target_type: reportTargetType, target_id: v.string(),
    reason: v.string(), details: v.optional(v.string()), status: reportStatus,
    priority: reportPriority, assigned_to: v.optional(v.id("profiles")),
    resolved_by: v.optional(v.id("profiles")), resolved_at: v.optional(v.number()),
    reviewed_at: v.optional(v.number()), created_at: v.number(), updated_at: v.number(),
  }).index("by_status_priority_created", ["status", "priority", "created_at"])
    .index("by_target", ["target_type", "target_id", "created_at"])
    .index("by_reporter_target", ["reporter_id", "target_type", "target_id", "created_at"]),

  moderation_actions: defineTable({
    actor_id: v.id("profiles"), target_type: moderationTargetType, target_id: v.string(),
    action: v.string(), reason: v.optional(v.string()), metadata: flatJson, created_at: v.number(),
  }).index("by_actor_created", ["actor_id", "created_at"])
    .index("by_target", ["target_type", "target_id", "created_at"]),

  ranking_config: defineTable({
    seed_key: v.string(), mood_match_weight: v.number(), trust_weight: v.number(),
    freshness_weight: v.number(), proximity_weight: v.number(),
    quality_engagement_weight: v.number(), bayesian_prior_mean: v.number(),
    bayesian_prior_strength: v.number(), save_weight: v.number(), been_there_weight: v.number(),
    share_weight: v.number(), like_weight: v.number(), freshness_half_life_days: v.number(),
    min_samples_early: v.number(), min_samples_medium: v.number(),
    editorial_cold_start_weight: v.number(), geofence_radius_meters: v.number(),
    updated_at: v.number(), updated_by: v.optional(v.id("profiles")),
  }).index("by_seed_key", ["seed_key"]),

  feature_flags: defineTable({
    seed_key: v.string(), key: v.string(), enabled: v.boolean(),
    description: v.optional(v.string()), updated_at: v.number(),
    updated_by: v.optional(v.id("profiles")),
  }).index("by_key", ["key"]).index("by_seed_key", ["seed_key"]),

  product_events: defineTable({
    event_name: v.string(), user_id: v.optional(v.id("profiles")),
    session_id: v.optional(v.string()), properties: flatJson, created_at: v.number(),
  }).index("by_name_created", ["event_name", "created_at"])
    .index("by_user_created", ["user_id", "created_at"]),

  saved_posts: defineTable({
    user_id: v.id("profiles"), post_id: v.id("experience_posts"),
    pair_key: v.string(), created_at: v.number(),
  }).index("by_pair", ["pair_key"]).index("by_user_created", ["user_id", "created_at"])
    .index("by_post", ["post_id"]),

  notifications: defineTable({
    user_id: v.id("profiles"), actor_id: v.optional(v.id("profiles")), type: notificationType,
    post_id: v.optional(v.id("experience_posts")), comment_id: v.optional(v.id("comments")),
    message_id: v.optional(v.id("messages")), read_at: v.optional(v.number()),
    idempotency_key: v.optional(v.string()), metadata: flatJson, created_at: v.number(),
  }).index("by_user_read_created", ["user_id", "read_at", "created_at"])
    .index("by_idempotency_key", ["idempotency_key"])
    .index("by_user_message", ["user_id", "message_id"]),

  feed_ranking_config: defineTable({
    seed_key: v.string(), social_affinity_weight: v.number(),
    content_relevance_weight: v.number(), recency_weight: v.number(),
    verified_weight: v.number(), quality_engagement_weight: v.number(),
    mood_context_weight: v.number(), location_weight: v.number(), save_weight: v.number(),
    comment_weight: v.number(), share_weight: v.number(), like_weight: v.number(),
    recency_half_life_hours: v.number(), updated_at: v.number(),
    updated_by: v.optional(v.id("profiles")),
  }).index("by_seed_key", ["seed_key"]),

  place_recommendation_feedback: defineTable({
    user_id: v.id("profiles"), place_id: v.id("places"), mood_id: v.optional(v.id("moods")),
    pair_key: v.string(), kind: feedbackKind, created_at: v.number(),
  }).index("by_pair", ["pair_key"]).index("by_user_created", ["user_id", "created_at"])
    .index("by_place_kind", ["place_id", "kind"]),

  community_question_meta: defineTable({
    post_id: v.id("experience_posts"), area_label: v.optional(v.string()),
    budget_max: v.optional(v.number()), mood_id: v.optional(v.id("moods")),
    visit_context: v.optional(visitContext), time_label: v.optional(v.string()),
    crowd_preference: v.optional(crowdLevel), created_at: v.number(),
  }).index("by_post", ["post_id"]),

  user_interest_signals: defineTable({
    user_id: v.id("profiles"), entity_type: entityType, entity_id: v.optional(v.string()),
    signal_type: v.string(), weight: v.number(), created_at: v.number(),
  }).index("by_user_created", ["user_id", "created_at"])
    .index("by_user_entity", ["user_id", "entity_type", "entity_id"]),

  conversations: defineTable({
    is_direct: v.boolean(), direct_pair_key: v.optional(v.string()),
    last_message_at: v.number(), created_at: v.number(),
  }).index("by_direct_pair", ["direct_pair_key"]).index("by_last_message", ["last_message_at"]),

  conversation_participants: defineTable({
    conversation_id: v.id("conversations"), user_id: v.id("profiles"), pair_key: v.string(),
    last_read_at: v.optional(v.number()), joined_at: v.number(), muted: v.boolean(),
  }).index("by_pair", ["pair_key"]).index("by_user", ["user_id", "last_read_at"])
    .index("by_conversation", ["conversation_id"]),

  messages: defineTable({
    conversation_id: v.id("conversations"), sender_id: v.id("profiles"),
    body: v.optional(v.string()), kind: messageKind, payload: flatJson,
    reply_to_message_id: v.optional(v.id("messages")), edited_at: v.optional(v.number()),
    client_id: v.optional(v.string()), sender_client_key: v.optional(v.string()),
    created_at: v.number(), deleted_at: v.optional(v.number()),
  }).index("by_conversation_created", ["conversation_id", "created_at"])
    .index("by_sender_client", ["sender_client_key"]).index("by_reply", ["reply_to_message_id"]),

  conversation_typing: defineTable({
    conversation_id: v.id("conversations"), user_id: v.id("profiles"),
    session_key: v.string(), typed_at: v.number(), expires_at: v.number(),
  }).index("by_session_key", ["session_key"]).index("by_conversation_expiry", ["conversation_id", "expires_at"])
    .index("by_expiry", ["expires_at"]),

  place_invitations: defineTable({
    place_id: v.id("places"), from_user_id: v.id("profiles"), to_user_id: v.id("profiles"),
    conversation_id: v.optional(v.id("conversations")), message_id: v.optional(v.id("messages")),
    suggested_date: v.optional(v.string()), suggested_time: v.optional(v.string()),
    note: v.optional(v.string()), status: invitationStatus,
    responded_at: v.optional(v.number()), created_at: v.number(),
  }).index("by_to_created", ["to_user_id", "created_at"]).index("by_from_created", ["from_user_id", "created_at"])
    .index("by_conversation", ["conversation_id"]),

  message_reactions: defineTable({
    message_id: v.id("messages"), user_id: v.id("profiles"),
    pair_key: v.string(), reaction, created_at: v.number(),
  }).index("by_pair", ["pair_key"]).index("by_message", ["message_id"]).index("by_user", ["user_id"]),

  user_blocks: defineTable({
    blocker_id: v.id("profiles"), blocked_id: v.id("profiles"),
    pair_key: v.string(), created_at: v.number(),
  }).index("by_pair", ["pair_key"]).index("by_blocker", ["blocker_id"])
    .index("by_blocked", ["blocked_id"]),

  auth_lockouts: defineTable({
    email_normalized: v.string(), failed_count: v.number(),
    locked_until: v.optional(v.number()), updated_at: v.number(),
  }).index("by_email", ["email_normalized"]).index("by_locked_until", ["locked_until"]),

  auth_code_requests: defineTable({
    request_key: v.string(), window_started_at: v.number(), count: v.number(),
  }).index("by_request_key", ["request_key"]),

  user_hidden_posts: defineTable({
    user_id: v.id("profiles"), post_id: v.id("experience_posts"),
    pair_key: v.string(), created_at: v.number(),
  }).index("by_pair", ["pair_key"]).index("by_user", ["user_id"]).index("by_post", ["post_id"]),

  place_media: defineTable({
    place_id: v.id("places"), storage_id: v.id("_storage"), alt_text: v.optional(v.string()),
    sort_order: v.number(), created_by: v.optional(v.id("profiles")), created_at: v.number(),
  }).index("by_place_order", ["place_id", "sort_order"]).index("by_storage", ["storage_id"]),

  audit_logs: defineTable({
    actor_id: v.optional(v.id("profiles")), action: v.string(), target_type: v.string(),
    target_id: v.optional(v.string()), before: v.optional(flatJson), after: v.optional(flatJson),
    reason: v.optional(v.string()), ip: v.optional(v.string()), user_agent: v.optional(v.string()),
    correlation_id: v.optional(v.string()), created_at: v.number(),
  }).index("by_actor_created", ["actor_id", "created_at"])
    .index("by_target_created", ["target_type", "target_id", "created_at"])
    .index("by_action_created", ["action", "created_at"]),

  editorial_collections: defineTable({
    seed_key: v.optional(v.string()), slug: v.string(), title: v.string(),
    description: v.optional(v.string()), kind: editorialKind, status: editorialStatus,
    sort_order: v.number(), starts_at: v.optional(v.number()), ends_at: v.optional(v.number()),
    created_by: v.optional(v.id("profiles")), updated_by: v.optional(v.id("profiles")),
    created_at: v.number(), updated_at: v.number(),
  }).index("by_slug", ["slug"]).index("by_seed_key", ["seed_key"])
    .index("by_status_order", ["status", "sort_order"]),

  editorial_collection_items: defineTable({
    collection_id: v.id("editorial_collections"), target_type: v.string(),
    target_id: v.string(), unique_key: v.string(), sort_order: v.number(),
  }).index("by_unique_key", ["unique_key"]).index("by_collection_order", ["collection_id", "sort_order"]),

  featured_placements: defineTable({
    seed_key: v.optional(v.string()), surface: featuredSurface, target_type: v.string(),
    target_id: v.string(), live_key: v.optional(v.string()), sort_order: v.number(),
    status: editorialStatus, starts_at: v.optional(v.number()), ends_at: v.optional(v.number()),
    created_by: v.optional(v.id("profiles")), updated_by: v.optional(v.id("profiles")),
    created_at: v.number(), updated_at: v.number(),
  }).index("by_seed_key", ["seed_key"]).index("by_live_key", ["live_key"])
    .index("by_surface_status_order", ["surface", "status", "sort_order"]),
});

export default schema;

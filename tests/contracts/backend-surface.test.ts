import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  canAssignRoles,
  canManagePlaces,
  canManageUsers,
  canModerate,
} from "@/lib/auth/roles";
import { notificationIdempotencyKey } from "@/features/notifications/keys";
import { presenceCopy } from "@/features/presence/format";
import { ADJACENT_ROLE_NEGATIVES } from "@/tests/fixtures/security-principals";
import { haversineMeters, isValidCoordinate } from "@/lib/geo/distance";
import { rankPlace } from "@/lib/ranking";
import { GEO_PARITY } from "@/tests/fixtures/geo-parity";
import {
  BASELINE_PLACE,
  BASELINE_RANKING,
  RANKING_NOW,
} from "@/tests/fixtures/ranking-parity";

const TABLES = [
  "profiles", "user_preferences", "moods", "experience_styles",
  "place_categories", "places", "place_moods", "place_styles",
  "experience_posts", "post_media", "experience_mood_ratings",
  "experience_metrics", "place_mood_stats", "place_experience_stats",
  "place_crowd_stats", "place_cost_stats", "place_time_stats",
  "place_recommendation_feedback", "saved_collections", "saves",
  "visit_claims", "visit_verifications", "saved_posts", "notifications",
  "feed_ranking_config", "follows", "post_likes", "comments", "shares",
  "reports", "auth_lockouts", "user_hidden_posts", "place_media",
  "audit_logs", "editorial_collections", "editorial_collection_items",
  "featured_placements", "moderation_actions", "ranking_config",
  "feature_flags", "product_events", "travel_dna_profiles",
  "creator_reputation", "community_question_meta", "user_interest_signals",
  "conversations", "conversation_participants", "messages",
  "conversation_typing", "place_invitations", "message_reactions",
  "user_blocks",
] as const;

const STORAGE_POLICIES = {
  avatars: { read: "visible-profile", write: "owner", maxBytes: 5 * 1024 * 1024 },
  experienceMedia: { read: "post-visibility", write: "author-or-staff", maxImageBytes: 8 * 1024 * 1024, maxVideoBytes: 50 * 1024 * 1024 },
  placeMedia: { read: "visible-place", write: "place-manager", maxBytes: 10 * 1024 * 1024 },
  messageMedia: { read: "conversation-member", write: "member-sender", maxBytes: 8 * 1024 * 1024 },
} as const;

describe("backend surface contract", () => {
  it("freezes all 52 active domain tables", () => {
    expect(TABLES).toHaveLength(52);
    const source = readFileSync("types/database.ts", "utf8");
    for (const table of TABLES) {
      expect(source).toMatch(new RegExp(`\\n\\s+${table}: TableDef<`));
    }
  });

  it("freezes the four storage authorization domains", () => {
    expect(STORAGE_POLICIES).toMatchInlineSnapshot(`
      {
        "avatars": {
          "maxBytes": 5242880,
          "read": "visible-profile",
          "write": "owner",
        },
        "experienceMedia": {
          "maxImageBytes": 8388608,
          "maxVideoBytes": 52428800,
          "read": "post-visibility",
          "write": "author-or-staff",
        },
        "messageMedia": {
          "maxBytes": 8388608,
          "read": "conversation-member",
          "write": "member-sender",
        },
        "placeMedia": {
          "maxBytes": 10485760,
          "read": "visible-place",
          "write": "place-manager",
        },
      }
    `);
  });

  it("freezes adjacent role boundaries", () => {
    for (const role of ADJACENT_ROLE_NEGATIVES.moderate) expect(canModerate(role)).toBe(false);
    for (const role of ADJACENT_ROLE_NEGATIVES.managePlaces) expect(canManagePlaces(role)).toBe(false);
    for (const role of ADJACENT_ROLE_NEGATIVES.manageUsers) expect(canManageUsers(role)).toBe(false);
    for (const role of ADJACENT_ROLE_NEGATIVES.ownerOnly) expect(canAssignRoles(role, "owner")).toBe(false);
    expect(canModerate("moderator")).toBe(true);
    expect(canManagePlaces("editor")).toBe(true);
    expect(canManageUsers("admin")).toBe(true);
    expect(canAssignRoles("owner", "owner")).toBe(true);
  });

  it("freezes notification keys and presence copy", () => {
    expect(notificationIdempotencyKey({
      type: "message", actorId: "a", recipientId: "b", messageId: "m",
    })).toBe("message:m");
    expect(notificationIdempotencyKey({
      type: "new_follower", actorId: "a", recipientId: "b",
    })).toBe("follow:a:b");
    expect(presenceCopy("online")).toBe("Đang hoạt động");
    expect(presenceCopy("hidden")).toBeNull();
  });

  it("freezes geospatial and ranking parity fixtures", () => {
    const [lat1, lng1, lat2, lng2] = GEO_PARITY.saigonScale.points;
    expect(haversineMeters(lat1, lng1, lat2, lng2)).toBeCloseTo(
      GEO_PARITY.saigonScale.meters,
      9,
    );
    for (const [lat, lng] of GEO_PARITY.validBoundary) expect(isValidCoordinate(lat, lng)).toBe(true);
    for (const [lat, lng] of GEO_PARITY.invalid) expect(isValidCoordinate(lat, lng)).toBe(false);
    expect(rankPlace(BASELINE_PLACE, { now: RANKING_NOW })).toEqual(BASELINE_RANKING);
  });
});

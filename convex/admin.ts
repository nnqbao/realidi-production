import { invalidateSessions } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { requireAdmin, requireStaff } from "./_lib/authz";
import { appendAudit } from "./_lib/audit";
import { canAssignRole, hasCapability } from "./_lib/capabilities";
import { iso } from "./_lib/dtos";
import { invariant } from "./_lib/errors";
import { userRole } from "./validators";

async function ownerCount(ctx: MutationCtx) {
  const owners = await ctx.db.query("profiles").withIndex("by_role", (q) => q.eq("role", "owner")).take(8);
  return owners.length;
}

export const dashboard = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const now = Date.now();
    const d7 = now - 7 * 24 * 60 * 60_000;
    const d30 = now - 30 * 24 * 60 * 60_000;
    const profiles = await ctx.db.query("profiles").take(200);
    const places = await ctx.db.query("places").take(200);
    const posts = await ctx.db.query("experience_posts").take(200);
    const reports = await ctx.db.query("reports").take(80);
    const recent = await ctx.db.query("audit_logs").order("desc").take(8);
    return {
      users: profiles.length,
      users7: profiles.filter((row) => row.created_at >= d7).length,
      users30: profiles.filter((row) => row.created_at >= d30).length,
      places: places.filter((row) => row.deleted_at === undefined).length,
      placesDraft: places.filter((row) => row.status === "pending" || row.status === "draft").length,
      placesPublished: places.filter((row) => row.status === "active").length,
      placesHidden: places.filter((row) => row.status === "hidden").length,
      posts: posts.filter((row) => row.status === "published").length,
      reportsOpen: reports.filter((row) => row.status === "pending" || row.status === "investigating").length,
      reportsHigh: reports.filter(
        (row) =>
          row.priority === "high" && (row.status === "pending" || row.status === "investigating"),
      ).length,
      suspended: profiles.filter((row) => row.suspended_at !== undefined && row.banned_at === undefined).length,
      recent: recent.map((row) => ({
        id: row._id as string,
        action: row.action,
        target_type: row.target_type,
        created_at: iso(row.created_at),
        actor_id: row.actor_id ?? null,
      })),
    };
  },
});

export const listUsers = query({
  args: { query: v.optional(v.string()), role: v.optional(userRole) },
  handler: async (ctx, args) => {
    const { profile } = await requireStaff(ctx);
    invariant(
      hasCapability(profile.role, "manageUsers") || hasCapability(profile.role, "moderate"),
      "FORBIDDEN",
      "Insufficient capability",
    );
    const rows = args.role
      ? await ctx.db.query("profiles").withIndex("by_role", (q) => q.eq("role", args.role!)).take(100)
      : await ctx.db.query("profiles").take(100);
    const needle = args.query?.trim().toLowerCase() ?? "";
    return rows
      .filter((row) =>
        needle.length === 0
          ? true
          : `${row.display_name} ${row.username}`.toLowerCase().includes(needle),
      )
      .map((row) => ({
        id: row._id as string,
        display_name: row.display_name,
        username: row.username,
        role: row.role,
        created_at: iso(row.created_at),
        suspended_at: iso(row.suspended_at),
        banned_at: iso(row.banned_at),
      }));
  },
});

export const staffOptions = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const roles = ["owner", "admin", "moderator"] as const;
    const out = [];
    for (const role of roles) {
      const rows = await ctx.db.query("profiles").withIndex("by_role", (q) => q.eq("role", role)).take(20);
      for (const row of rows) out.push({ id: row._id as string, display_name: row.display_name, role: row.role });
    }
    return out;
  },
});

export const listAudit = query({
  args: { query: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { profile } = await requireAdmin(ctx);
    invariant(hasCapability(profile.role, "readAudit"), "FORBIDDEN", "Insufficient capability");
    const rows = await ctx.db.query("audit_logs").order("desc").take(120);
    const needle = args.query?.trim().toLowerCase() ?? "";
    return rows
      .filter((row) =>
        needle.length === 0
          ? true
          : `${row.action} ${row.target_type} ${row.reason ?? ""}`.toLowerCase().includes(needle),
      )
      .map((row) => ({
        id: row._id as string,
        action: row.action,
        target_type: row.target_type,
        target_id: row.target_id ?? null,
        reason: row.reason ?? null,
        created_at: iso(row.created_at),
      }));
  },
});

export const listFlags = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("feature_flags").take(40);
    return rows
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((row) => ({
        key: row.key,
        enabled: row.enabled,
        description: row.description ?? null,
      }));
  },
});

export const updateRanking = mutation({
  args: {
    moodMatchWeight: v.number(),
    trustWeight: v.number(),
    freshnessWeight: v.number(),
    proximityWeight: v.number(),
    qualityEngagementWeight: v.number(),
    bayesianPriorMean: v.number(),
    bayesianPriorStrength: v.number(),
    geofenceRadiusMeters: v.number(),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireAdmin(ctx);
    invariant(hasCapability(profile.role, "manageRanking"), "FORBIDDEN", "Insufficient capability");
    const sum =
      args.moodMatchWeight +
      args.trustWeight +
      args.freshnessWeight +
      args.proximityWeight +
      args.qualityEngagementWeight;
    invariant(Math.abs(sum - 1) <= 0.001, "VALIDATION_FAILED", "WEIGHTS_MUST_SUM_TO_1");
    const row = await ctx.db
      .query("ranking_config")
      .withIndex("by_seed_key", (q) => q.eq("seed_key", "ranking:default"))
      .unique();
    invariant(row !== null, "NOT_FOUND", "Ranking config missing");
    const now = Date.now();
    await ctx.db.patch(row._id, {
      mood_match_weight: args.moodMatchWeight,
      trust_weight: args.trustWeight,
      freshness_weight: args.freshnessWeight,
      proximity_weight: args.proximityWeight,
      quality_engagement_weight: args.qualityEngagementWeight,
      bayesian_prior_mean: args.bayesianPriorMean,
      bayesian_prior_strength: args.bayesianPriorStrength,
      geofence_radius_meters: args.geofenceRadiusMeters,
      updated_by: profile._id,
      updated_at: now,
    });
    await appendAudit(ctx, {
      actor_id: profile._id,
      action: "ranking_updated",
      target_type: "ranking",
      target_id: row._id,
      created_at: now,
    });
    return { ok: true as const };
  },
});

export const updateFeedRanking = mutation({
  args: {
    socialAffinityWeight: v.number(),
    contentRelevanceWeight: v.number(),
    recencyWeight: v.number(),
    verifiedWeight: v.number(),
    qualityEngagementWeight: v.number(),
    moodContextWeight: v.number(),
    locationWeight: v.number(),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireAdmin(ctx);
    const sum =
      args.socialAffinityWeight +
      args.contentRelevanceWeight +
      args.recencyWeight +
      args.verifiedWeight +
      args.qualityEngagementWeight +
      args.moodContextWeight +
      args.locationWeight;
    invariant(Math.abs(sum - 1) <= 0.001, "VALIDATION_FAILED", "WEIGHTS_MUST_SUM_TO_1");
    const row = await ctx.db
      .query("feed_ranking_config")
      .withIndex("by_seed_key", (q) => q.eq("seed_key", "feed-ranking:default"))
      .unique();
    invariant(row !== null, "NOT_FOUND", "Feed ranking config missing");
    const now = Date.now();
    await ctx.db.patch(row._id, {
      social_affinity_weight: args.socialAffinityWeight,
      content_relevance_weight: args.contentRelevanceWeight,
      recency_weight: args.recencyWeight,
      verified_weight: args.verifiedWeight,
      quality_engagement_weight: args.qualityEngagementWeight,
      mood_context_weight: args.moodContextWeight,
      location_weight: args.locationWeight,
      updated_by: profile._id,
      updated_at: now,
    });
    await appendAudit(ctx, {
      actor_id: profile._id,
      action: "feed_ranking_updated",
      target_type: "ranking",
      target_id: row._id,
      created_at: now,
    });
    return { ok: true as const };
  },
});

export const toggleFlag = mutation({
  args: { key: v.string(), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const { profile } = await requireAdmin(ctx);
    const row = await ctx.db.query("feature_flags").withIndex("by_key", (q) => q.eq("key", args.key)).unique();
    invariant(row !== null, "NOT_FOUND", "Flag not found");
    const now = Date.now();
    await ctx.db.patch(row._id, { enabled: args.enabled, updated_by: profile._id, updated_at: now });
    await appendAudit(ctx, {
      actor_id: profile._id,
      action: "flag_toggled",
      target_type: "flag",
      target_id: args.key,
      before: { enabled: row.enabled },
      after: { enabled: args.enabled },
      created_at: now,
    });
    return { ok: true as const };
  },
});

export const applyRole = internalMutation({
  args: { userId: v.id("profiles"), role: userRole, reason: v.string() },
  handler: async (ctx, args) => {
    const { profile } = await requireAdmin(ctx);
    if (!canAssignRole(profile.role, args.role)) return { error: "FORBIDDEN_ROLE" as const };
    const target = await ctx.db.get(args.userId);
    if (target === null) return { error: "NOT_FOUND" as const };
    if (target.role === "owner" && args.role !== "owner" && (await ownerCount(ctx)) <= 1) {
      return { error: "LAST_OWNER" as const };
    }
    await ctx.db.patch(args.userId, { role: args.role, updated_at: Date.now() });
    await appendAudit(ctx, {
      actor_id: profile._id,
      action: "set_role",
      target_type: "user",
      target_id: args.userId,
      before: { role: target.role },
      after: { role: args.role },
      reason: args.reason,
      created_at: Date.now(),
    });
    return { ok: true as const, authUserId: target.auth_user_id, revoke: true as const };
  },
});

export const applyUserStatus = internalMutation({
  args: {
    userId: v.id("profiles"),
    action: v.union(v.literal("suspend"), v.literal("unsuspend"), v.literal("ban"), v.literal("restore")),
    reason: v.string(),
    hours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireAdmin(ctx);
    if (!args.reason.trim() && args.action !== "unsuspend" && args.action !== "restore") {
      return { error: "REASON_REQUIRED" as const };
    }
    const target = await ctx.db.get(args.userId);
    if (target === null) return { error: "NOT_FOUND" as const };
    if (target.role === "owner" && args.action === "ban" && (await ownerCount(ctx)) <= 1) {
      return { error: "LAST_OWNER" as const };
    }
    const now = Date.now();
    if (args.action === "suspend") {
      await ctx.db.patch(args.userId, {
        suspended_at: now,
        suspension_ends_at: args.hours ? now + args.hours * 3600_000 : undefined,
        updated_at: now,
      });
    }
    if (args.action === "unsuspend") {
      await ctx.db.patch(args.userId, { suspended_at: undefined, suspension_ends_at: undefined, updated_at: now });
    }
    if (args.action === "ban") {
      await ctx.db.patch(args.userId, { banned_at: now, ban_reason: args.reason, updated_at: now });
    }
    if (args.action === "restore") {
      await ctx.db.patch(args.userId, {
        banned_at: undefined,
        ban_reason: undefined,
        suspended_at: undefined,
        suspension_ends_at: undefined,
        updated_at: now,
      });
    }
    await appendAudit(ctx, {
      actor_id: profile._id,
      action: `user_${args.action}`,
      target_type: "user",
      target_id: args.userId,
      reason: args.reason,
      created_at: now,
    });
    return {
      ok: true as const,
      authUserId: target.auth_user_id,
      revoke: args.action === "ban" || args.action === "suspend",
    };
  },
});

type RoleChangeResult = { ok: true } | { error: "FORBIDDEN_ROLE" | "LAST_OWNER" | "NOT_FOUND" };
type UserStatusResult = { ok: true } | { error: "LAST_OWNER" | "NOT_FOUND" | "REASON_REQUIRED" };

export const changeRole = action({
  args: { userId: v.id("profiles"), role: userRole, reason: v.string() },
  handler: async (ctx, args): Promise<RoleChangeResult> => {
    const result = await ctx.runMutation(internal.admin.applyRole, args);
    if (result.ok && result.authUserId) {
      await invalidateSessions(ctx, { userId: result.authUserId });
      return { ok: true };
    }
    return { error: result.error ?? "NOT_FOUND" };
  },
});

export const setUserStatus = action({
  args: {
    userId: v.id("profiles"),
    action: v.union(v.literal("suspend"), v.literal("unsuspend"), v.literal("ban"), v.literal("restore")),
    reason: v.string(),
    hours: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<UserStatusResult> => {
    const result = await ctx.runMutation(internal.admin.applyUserStatus, args);
    if (result.ok) {
      if (result.revoke && result.authUserId) {
        await invalidateSessions(ctx, { userId: result.authUserId });
      }
      return { ok: true };
    }
    return { error: result.error ?? "NOT_FOUND" };
  },
});

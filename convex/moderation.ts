import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireModerator } from "./_lib/authz";
import { appendAudit } from "./_lib/audit";
import { iso } from "./_lib/dtos";
import { invariant } from "./_lib/errors";
import { refreshPlaceAggregates } from "./_lib/placeAggregates";
import { reportStatus } from "./validators";

async function noteModeration(
  ctx: Parameters<typeof appendAudit>[0],
  actorId: Id<"profiles">,
  targetType: "post" | "comment" | "user" | "place" | "report" | "message",
  targetId: string,
  action: string,
  reason?: string,
) {
  const now = Date.now();
  await ctx.db.insert("moderation_actions", {
    actor_id: actorId,
    target_type: targetType,
    target_id: targetId,
    action,
    metadata: {},
    created_at: now,
    ...(reason ? { reason } : {}),
  });
  await appendAudit(ctx, {
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId,
    reason,
    created_at: now,
  });
}

export const hidePost = mutation({
  args: { postId: v.id("experience_posts"), reason: v.string() },
  handler: async (ctx, args) => {
    const { profile } = await requireModerator(ctx);
    invariant(args.reason.trim().length > 0, "VALIDATION_FAILED", "REASON_REQUIRED");
    const post = await ctx.db.get(args.postId);
    invariant(post !== null, "NOT_FOUND", "Post not found");
    await ctx.db.patch(args.postId, {
      moderation_status: "hidden",
      status: "hidden",
      updated_at: Date.now(),
    });
    await noteModeration(ctx, profile._id, "post", args.postId, "post_hidden", args.reason.trim());
    return { ok: true as const };
  },
});

export const restorePost = mutation({
  args: { postId: v.id("experience_posts") },
  handler: async (ctx, args) => {
    const { profile } = await requireModerator(ctx);
    const post = await ctx.db.get(args.postId);
    invariant(post !== null, "NOT_FOUND", "Post not found");
    await ctx.db.patch(args.postId, {
      moderation_status: "approved",
      status: "published",
      updated_at: Date.now(),
    });
    await noteModeration(ctx, profile._id, "post", args.postId, "post_restored");
    return { ok: true as const };
  },
});

export const removeComment = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, args) => {
    const { profile } = await requireModerator(ctx);
    const comment = await ctx.db.get(args.commentId);
    invariant(comment !== null, "NOT_FOUND", "Comment not found");
    await ctx.db.patch(args.commentId, {
      deleted_at: Date.now(),
      moderation_status: "rejected",
      updated_at: Date.now(),
    });
    await noteModeration(ctx, profile._id, "comment", args.commentId, "remove_comment");
    return { ok: true as const };
  },
});

export const assignReport = mutation({
  args: { reportId: v.id("reports"), assigneeId: v.union(v.id("profiles"), v.null()) },
  handler: async (ctx, args) => {
    const { profile } = await requireModerator(ctx);
    const report = await ctx.db.get(args.reportId);
    invariant(report !== null, "NOT_FOUND", "Report not found");
    const now = Date.now();
    await ctx.db.patch(args.reportId, {
      assigned_to: args.assigneeId ?? undefined,
      status: "investigating",
      reviewed_at: now,
      updated_at: now,
    });
    await appendAudit(ctx, {
      actor_id: profile._id,
      action: "report_assigned",
      target_type: "report",
      target_id: args.reportId,
      after: { assigned_to: args.assigneeId },
      created_at: now,
    });
    return { ok: true as const };
  },
});

export const resolveReport = mutation({
  args: { reportId: v.id("reports"), status: reportStatus },
  handler: async (ctx, args) => {
    const { profile } = await requireModerator(ctx);
    const report = await ctx.db.get(args.reportId);
    invariant(report !== null, "NOT_FOUND", "Report not found");
    const now = Date.now();
    const investigating = args.status === "investigating" || args.status === "pending";
    await ctx.db.patch(args.reportId, {
      status: args.status,
      resolved_by: investigating ? undefined : profile._id,
      resolved_at: investigating ? undefined : now,
      updated_at: now,
    });
    await noteModeration(ctx, profile._id, "report", args.reportId, args.status);
    return { ok: true as const };
  },
});

export const moderateReport = mutation({
  args: {
    reportId: v.id("reports"),
    decision: v.union(v.literal("dismissed"), v.literal("resolved")),
    reason: v.string(),
    hideTarget: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireModerator(ctx);
    const report = await ctx.db.get(args.reportId);
    invariant(report !== null, "NOT_FOUND", "NOT_FOUND");
    if (args.hideTarget && (report.target_type === "post" || report.target_type === "comment")) {
      if (report.target_type === "post") {
        const post = await ctx.db.get(report.target_id as Id<"experience_posts">);
        if (post) {
          await ctx.db.patch(post._id, { moderation_status: "hidden", status: "hidden", updated_at: Date.now() });
        }
      } else {
        const comment = await ctx.db.get(report.target_id as Id<"comments">);
        if (comment) {
          await ctx.db.patch(comment._id, {
            deleted_at: Date.now(),
            moderation_status: "rejected",
            updated_at: Date.now(),
          });
        }
      }
    }
    const now = Date.now();
    await ctx.db.patch(args.reportId, {
      status: args.decision,
      resolved_by: profile._id,
      resolved_at: now,
      reviewed_at: now,
      updated_at: now,
    });
    await appendAudit(ctx, {
      actor_id: profile._id,
      action: "admin_report_actioned",
      target_type: "report",
      target_id: args.reportId,
      reason: args.reason,
      after: { decision: args.decision, hideTarget: args.hideTarget ?? false },
      created_at: now,
    });
    return { ok: true as const };
  },
});

export const reviewVerification = mutation({
  args: { verificationId: v.id("visit_verifications"), approve: v.boolean() },
  handler: async (ctx, args) => {
    const { profile } = await requireModerator(ctx);
    const row = await ctx.db.get(args.verificationId);
    invariant(row !== null, "NOT_FOUND", "Verification not found");
    const now = Date.now();
    await ctx.db.patch(args.verificationId, {
      result: args.approve ? "verified" : "failed",
      method: "admin",
      verified_at: args.approve ? now : undefined,
      confidence: args.approve ? 1 : 0,
    });
    if (args.approve && row.experience_post_id) {
      await ctx.db.patch(row.experience_post_id, { verification_status: "verified", updated_at: now });
    }
    if (args.approve) await refreshPlaceAggregates(ctx, row.place_id);
    await noteModeration(
      ctx,
      profile._id,
      "place",
      args.verificationId,
      args.approve ? "admin_verify" : "admin_reject_verify",
    );
    return { ok: true as const };
  },
});

export const listReports = query({
  args: { status: v.optional(reportStatus), query: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireModerator(ctx);
    const rows = await ctx.db.query("reports").order("desc").take(80);
    const needle = args.query?.trim().toLowerCase() ?? "";
    return rows
      .filter((row) => (args.status ? row.status === args.status : true))
      .filter((row) =>
        needle.length === 0
          ? true
          : `${row.reason} ${row.details ?? ""} ${row.target_type}`.toLowerCase().includes(needle),
      )
      .map((row) => ({
        id: row._id as string,
        target_type: row.target_type,
        target_id: row.target_id,
        reason: row.reason,
        details: row.details ?? null,
        status: row.status,
        priority: row.priority,
        created_at: iso(row.created_at),
      }));
  },
});

export const listPosts = query({
  args: {},
  handler: async (ctx) => {
    await requireModerator(ctx);
    const rows = await ctx.db.query("experience_posts").order("desc").take(80);
    const out = [];
    for (const row of rows) {
      const place = row.place_id ? await ctx.db.get(row.place_id) : null;
      const author = await ctx.db.get(row.author_id);
      out.push({
        id: row._id as string,
        caption: row.caption ?? null,
        status: row.status,
        moderation_status: row.moderation_status,
        verification_status: row.verification_status,
        placeName: place?.name ?? null,
        username: author?.username ?? null,
      });
    }
    return out;
  },
});

export const listComments = query({
  args: {},
  handler: async (ctx) => {
    await requireModerator(ctx);
    const rows = await ctx.db.query("comments").order("desc").take(80);
    const out = [];
    for (const row of rows) {
      const author = await ctx.db.get(row.author_id);
      out.push({
        id: row._id as string,
        body: row.body,
        deleted_at: iso(row.deleted_at),
        username: author?.username ?? null,
      });
    }
    return out;
  },
});

export const listVerifications = query({
  args: {},
  handler: async (ctx) => {
    await requireModerator(ctx);
    const rows = await ctx.db.query("visit_verifications").order("desc").take(80);
    const out = [];
    for (const row of rows) {
      const place = await ctx.db.get(row.place_id);
      const person = await ctx.db.get(row.user_id);
      out.push({
        id: row._id as string,
        result: row.result,
        confidence: row.confidence,
        distance_meters: row.distance_meters ?? null,
        method: row.method,
        placeName: place?.name ?? null,
        username: person?.username ?? null,
      });
    }
    return out;
  },
});

export const listActions = query({
  args: {},
  handler: async (ctx) => {
    await requireModerator(ctx);
    const rows = await ctx.db.query("moderation_actions").order("desc").take(80);
    const out = [];
    for (const row of rows) {
      const actor = await ctx.db.get(row.actor_id);
      out.push({
        id: row._id as string,
        action: row.action,
        target_type: row.target_type,
        reason: row.reason ?? null,
        created_at: iso(row.created_at),
        username: actor?.username ?? null,
      });
    }
    return out;
  },
});

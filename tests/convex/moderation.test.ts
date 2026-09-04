import { describe, expect, it } from "vitest";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { UserRole } from "@/convex/validators";
import { authHarness } from "./auth-harness";

async function insertPerson(
  t: ReturnType<typeof authHarness>,
  username: string,
  role: UserRole = "user",
) {
  return await t.run(async (ctx) => {
    const authUser = await ctx.db.insert("users", {
      email: `${username}@test.dev`,
      emailVerificationTime: 1,
    });
    const profile = await ctx.db.insert("profiles", {
      auth_user_id: authUser,
      username,
      display_name: username,
      role,
      locale: "vi",
      timezone: "Asia/Ho_Chi_Minh",
      show_activity_status: true,
      created_at: Date.now(),
      updated_at: Date.now(),
    });
    return { authUser, profile };
  });
}

function clientOf(
  t: ReturnType<typeof authHarness>,
  person: { authUser: Id<"users"> },
  session = "s-mod",
) {
  return t.withIdentity({ subject: `${person.authUser}|${session}` });
}

async function insertPlace(t: ReturnType<typeof authHarness>, slug: string) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("places", {
      slug,
      name: slug,
      normalized_search: slug,
      city: "TP. Hồ Chí Minh",
      country: "VN",
      currency: "VND",
      latitude_e6: 10_776_000,
      longitude_e6: 106_700_000,
      status: "active",
      source: "editorial",
      verified_by_admin: true,
      editorial_score: 0.5,
      admin_quality_score: 0.5,
      created_at: Date.now(),
      updated_at: Date.now(),
    });
  });
}

async function insertPost(
  t: ReturnType<typeof authHarness>,
  author: Id<"profiles">,
  placeId?: Id<"places">,
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("experience_posts", {
      author_id: author,
      place_id: placeId,
      caption: "cafe morning",
      status: "published",
      post_type: "experience",
      visibility: "public",
      verification_status: "unverified",
      moderation_status: "approved",
      like_count: 0,
      comment_count: 0,
      share_count: 0,
      save_count: 0,
      published_at: Date.now(),
      created_at: Date.now(),
      updated_at: Date.now(),
    });
  });
}

async function failureCode(operation: Promise<unknown>): Promise<string> {
  try {
    await operation;
    return "<no error>";
  } catch (error) {
    const data = (error as { data?: { code?: string } }).data;
    return data?.code ?? (error as Error).message;
  }
}

describe("moderation", () => {
  it("hides and restores a post, and removes a comment", async () => {
    const t = authHarness();
    const moderator = await insertPerson(t, "p7_mod_hide", "moderator");
    const author = await insertPerson(t, "p7_author");
    const postId = await insertPost(t, author.profile);
    const commentId = await t.run(async (ctx) => {
      return await ctx.db.insert("comments", {
        post_id: postId,
        author_id: author.profile,
        body: "spam",
        moderation_status: "approved",
        created_at: Date.now(),
        updated_at: Date.now(),
      });
    });
    const asMod = clientOf(t, moderator);

    expect(await failureCode(asMod.mutation(api.moderation.hidePost, { postId, reason: "   " }))).toBe(
      "VALIDATION_FAILED",
    );
    expect(await asMod.mutation(api.moderation.hidePost, { postId, reason: "spam" })).toEqual({ ok: true });
    const hidden = await t.run(async (ctx) => ctx.db.get(postId));
    expect(hidden?.moderation_status).toBe("hidden");
    expect(hidden?.status).toBe("hidden");

    expect(await asMod.mutation(api.moderation.restorePost, { postId })).toEqual({ ok: true });
    const restored = await t.run(async (ctx) => ctx.db.get(postId));
    expect(restored?.moderation_status).toBe("approved");
    expect(restored?.status).toBe("published");

    expect(await asMod.mutation(api.moderation.removeComment, { commentId })).toEqual({ ok: true });
    const comment = await t.run(async (ctx) => ctx.db.get(commentId));
    expect(comment?.deleted_at).toBeTypeOf("number");
    expect(comment?.moderation_status).toBe("rejected");
  });

  it("resolves a report and can hide the target", async () => {
    const t = authHarness();
    const moderator = await insertPerson(t, "p7_mod_report", "moderator");
    const author = await insertPerson(t, "p7_report_author");
    const postId = await insertPost(t, author.profile);
    const reportId = await t.run(async (ctx) => {
      return await ctx.db.insert("reports", {
        reporter_id: author.profile,
        target_type: "post",
        target_id: postId,
        reason: "spam",
        status: "pending",
        priority: "high",
        created_at: Date.now(),
        updated_at: Date.now(),
      });
    });
    const asMod = clientOf(t, moderator);
    expect(await asMod.mutation(api.moderation.assignReport, {
      reportId,
      assigneeId: moderator.profile,
    })).toEqual({ ok: true });
    expect(await asMod.mutation(api.moderation.moderateReport, {
      reportId,
      decision: "resolved",
      reason: "hide spam",
      hideTarget: true,
    })).toEqual({ ok: true });

    const report = await t.run(async (ctx) => ctx.db.get(reportId));
    const post = await t.run(async (ctx) => ctx.db.get(postId));
    expect(report?.status).toBe("resolved");
    expect(post?.moderation_status).toBe("hidden");
  });

  it("reviews a verification without exposing raw coordinates", async () => {
    const t = authHarness();
    const moderator = await insertPerson(t, "p7_mod_verify", "moderator");
    const visitor = await insertPerson(t, "p7_visitor");
    const placeId = await insertPlace(t, "p7-verify-place");
    const postId = await insertPost(t, visitor.profile, placeId);
    const verificationId = await t.run(async (ctx) => {
      return await ctx.db.insert("visit_verifications", {
        user_id: visitor.profile,
        place_id: placeId,
        experience_post_id: postId,
        method: "onsite_geolocation",
        result: "pending",
        confidence: 0.4,
        distance_meters: 42,
        metadata: {},
        created_at: Date.now(),
      });
    });
    const asMod = clientOf(t, moderator);
    expect(await asMod.mutation(api.moderation.reviewVerification, {
      verificationId,
      approve: true,
    })).toEqual({ ok: true });
    const row = await t.run(async (ctx) => ctx.db.get(verificationId));
    const post = await t.run(async (ctx) => ctx.db.get(postId));
    expect(row?.result).toBe("verified");
    expect(row?.method).toBe("admin");
    expect(post?.verification_status).toBe("verified");
    const listed = await asMod.query(api.moderation.listVerifications, {});
    expect(listed[0]).toMatchObject({
      id: verificationId,
      distance_meters: 42,
      username: "p7_visitor",
    });
    expect(listed[0]).not.toHaveProperty("latitude");
    expect(listed[0]).not.toHaveProperty("longitude");
  });

  it("blocks users, creators, and editors from moderator mutations", async () => {
    const t = authHarness();
    const editor = await insertPerson(t, "p7_editor_no_mod", "editor");
    const user = await insertPerson(t, "p7_user_no_mod");
    const author = await insertPerson(t, "p7_hidden_author");
    const postId = await insertPost(t, author.profile);

    expect(await failureCode(clientOf(t, user).mutation(api.moderation.hidePost, {
      postId,
      reason: "nope",
    }))).toBe("FORBIDDEN");
    expect(await failureCode(clientOf(t, editor).mutation(api.moderation.hidePost, {
      postId,
      reason: "nope",
    }))).toBe("FORBIDDEN");
    expect(await failureCode(clientOf(t, editor).query(api.moderation.listReports, {}))).toBe("FORBIDDEN");
  });
});

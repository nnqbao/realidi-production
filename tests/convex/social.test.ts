import { describe, expect, it } from "vitest";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { seedDatabase } from "@/convex/seed";
import { pairKey } from "@/convex/_lib/uniqueness";
import { authHarness } from "./auth-harness";

async function insertPerson(t: ReturnType<typeof authHarness>, username: string) {
  return await t.run(async (ctx) => {
    const authUser = await ctx.db.insert("users", {
      email: `${username}@test.dev`,
      emailVerificationTime: 1,
    });
    const profile = await ctx.db.insert("profiles", {
      auth_user_id: authUser,
      username,
      display_name: username,
      role: "user",
      locale: "vi",
      timezone: "Asia/Ho_Chi_Minh",
      show_activity_status: true,
      created_at: Date.now(),
      updated_at: Date.now(),
    });
    return { authUser, profile };
  });
}

describe("social graph", () => {
  it("keeps like/comment/save counters equal to source rows", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const author = await insertPerson(t, "author_social");
    const reader = await insertPerson(t, "reader_social");
    const authorClient = t.withIdentity({ subject: `${author.authUser}|s-a` });
    const readerClient = t.withIdentity({ subject: `${reader.authUser}|s-r` });
    const created = await authorClient.mutation(api.experiences.create, {
      caption: "Một buổi sáng",
      moodRatings: [],
    });

    expect(await readerClient.mutation(api.social.toggleLike, { postId: created.id })).toEqual({ liked: true });
    expect(await readerClient.mutation(api.social.toggleLike, { postId: created.id })).toEqual({ liked: false });
    expect(await readerClient.mutation(api.social.toggleLike, { postId: created.id })).toEqual({ liked: true });

    await readerClient.mutation(api.social.toggleSavePost, { postId: created.id });
    await readerClient.mutation(api.social.addComment, { postId: created.id, body: "Đáng đi." });
    const comment = await readerClient.mutation(api.social.addComment, { postId: created.id, body: "Lần hai." });
    await readerClient.mutation(api.social.deleteComment, { commentId: comment.id });

    const post = await t.run(async (ctx) => ctx.db.get(created.id));
    const likes = await t.run(async (ctx) =>
      ctx.db.query("post_likes").withIndex("by_post", (q) => q.eq("post_id", created.id)).collect(),
    );
    const saves = await t.run(async (ctx) =>
      ctx.db.query("saved_posts").withIndex("by_post", (q) => q.eq("post_id", created.id)).collect(),
    );
    const comments = await t.run(async (ctx) =>
      ctx.db
        .query("comments")
        .withIndex("by_post_created", (q) => q.eq("post_id", created.id))
        .collect()
        .then((rows) => rows.filter((row) => row.deleted_at === undefined)),
    );
    expect(post?.like_count).toBe(likes.length);
    expect(post?.save_count).toBe(saves.length);
    expect(post?.comment_count).toBe(comments.length);
    expect(likes).toHaveLength(1);
    expect(saves).toHaveLength(1);
    expect(comments).toHaveLength(1);
  });

  it("rejects self-follow and hides a post for the viewer only", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const person = await insertPerson(t, "solo_follow");
    const client = t.withIdentity({ subject: `${person.authUser}|s-solo` });
    expect(await client.mutation(api.social.toggleFollow, { userId: person.profile })).toEqual({
      following: false,
    });
    const follows = await t.run(async (ctx) =>
      ctx.db.query("follows").withIndex("by_follower", (q) => q.eq("follower_id", person.profile)).collect(),
    );
    expect(follows).toHaveLength(0);

    const created = await client.mutation(api.experiences.create, { caption: "ẩn đi", moodRatings: [] });
    await client.mutation(api.social.hidePost, { postId: created.id });
    expect(await client.query(api.social.hiddenIds, {})).toEqual([created.id]);
  });

  it("dedupes reports inside 24 hours", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const reporter = await insertPerson(t, "reporter");
    const client = t.withIdentity({ subject: `${reporter.authUser}|s-rep` });
    const first = await client.mutation(api.social.submitReport, {
      targetType: "post",
      targetId: "not-a-real-post-id-1",
      reason: "misleading",
    });
    const second = await client.mutation(api.social.submitReport, {
      targetType: "post",
      targetId: "not-a-real-post-id-1",
      reason: "misleading",
    });
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
  });

  it("toggles been-there with a stable pair key", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const person = await insertPerson(t, "been");
    const client = t.withIdentity({ subject: `${person.authUser}|s-been` });
    const places = await t.query(api.places.lite, {});
    const placeId = places[0]!.id as Id<"places">;
    expect(await client.mutation(api.social.toggleBeenThere, { placeId })).toEqual({ beenThere: true });
    expect(await client.mutation(api.social.toggleBeenThere, { placeId })).toEqual({ beenThere: false });
    const claim = await t.run(async (ctx) =>
      ctx.db.query("visit_claims").withIndex("by_pair", (q) => q.eq("pair_key", pairKey(person.profile, placeId))).unique(),
    );
    expect(claim).toBeNull();
  });
});

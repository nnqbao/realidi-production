import { describe, expect, it } from "vitest";
import { api } from "@/convex/_generated/api";
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

describe("notifications", () => {
  it("derives the actor, skips self, and dedupes likes", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const author = await insertPerson(t, "note_author");
    const reader = await insertPerson(t, "note_reader");
    const authorClient = t.withIdentity({ subject: `${author.authUser}|s-na` });
    const readerClient = t.withIdentity({ subject: `${reader.authUser}|s-nr` });
    const created = await authorClient.mutation(api.experiences.create, {
      caption: "thông báo",
      moodRatings: [],
    });

    await authorClient.mutation(api.social.toggleLike, { postId: created.id });
    await readerClient.mutation(api.social.toggleFollow, { userId: author.profile });
    await readerClient.mutation(api.social.toggleLike, { postId: created.id });
    await readerClient.mutation(api.social.toggleLike, { postId: created.id });
    await readerClient.mutation(api.social.toggleLike, { postId: created.id });

    const rows = await t.run(async (ctx) =>
      ctx.db.query("notifications").withIndex("by_user_read_created", (q) => q.eq("user_id", author.profile)).collect(),
    );
    expect(rows.filter((row) => row.type === "post_like")).toHaveLength(1);
    expect(rows.filter((row) => row.type === "new_follower")).toHaveLength(1);
    expect(rows.every((row) => row.actor_id !== row.user_id)).toBe(true);
    expect(rows.find((row) => row.type === "post_like")?.idempotency_key).toBe(
      `like:${created.id}:${reader.profile}`,
    );
  });

  it("suppresses notifications across a block", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const author = await insertPerson(t, "blocked_author");
    const reader = await insertPerson(t, "blocked_reader");
    await t.run(async (ctx) => {
      await ctx.db.insert("user_blocks", {
        blocker_id: author.profile,
        blocked_id: reader.profile,
        pair_key: pairKey(author.profile, reader.profile),
        created_at: Date.now(),
      });
    });
    const authorClient = t.withIdentity({ subject: `${author.authUser}|s-ba` });
    const readerClient = t.withIdentity({ subject: `${reader.authUser}|s-br` });
    const created = await authorClient.mutation(api.experiences.create, {
      caption: "blocked",
      moodRatings: [],
    });
    await readerClient.mutation(api.social.toggleLike, { postId: created.id });
    const rows = await t.run(async (ctx) =>
      ctx.db.query("notifications").withIndex("by_user_read_created", (q) => q.eq("user_id", author.profile)).collect(),
    );
    expect(rows).toHaveLength(0);
  });

  it("marks a notification read for its owner only", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const author = await insertPerson(t, "read_author");
    const reader = await insertPerson(t, "read_reader");
    const authorClient = t.withIdentity({ subject: `${author.authUser}|s-ra` });
    const readerClient = t.withIdentity({ subject: `${reader.authUser}|s-rr` });
    await authorClient.mutation(api.experiences.create, { caption: "đọc", moodRatings: [] });
    await readerClient.mutation(api.social.toggleFollow, { userId: author.profile });
    const note = await t.run(async (ctx) =>
      ctx.db.query("notifications").withIndex("by_user_read_created", (q) => q.eq("user_id", author.profile)).unique(),
    );
    expect(note).not.toBeNull();
    expect(await readerClient.mutation(api.notifications.markRead, { id: note!._id })).toEqual({ ok: false });
    expect(await authorClient.mutation(api.notifications.markRead, { id: note!._id })).toEqual({ ok: true });
    const after = await t.run(async (ctx) => ctx.db.get(note!._id));
    expect(after?.read_at).toBeTypeOf("number");
  });
});

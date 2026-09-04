import { describe, expect, it } from "vitest";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { seedDatabase } from "@/convex/seed";
import { pairKey } from "@/convex/_lib/uniqueness";
import { authHarness } from "./auth-harness";

async function insertPerson(
  t: ReturnType<typeof authHarness>,
  username: string,
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

async function insertPost(
  t: ReturnType<typeof authHarness>,
  args: {
    author: Id<"profiles">;
    caption: string;
    visibility?: "public" | "followers" | "private";
    moderation?: "approved" | "hidden";
    deleted?: boolean;
    publishedAt?: number;
  },
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("experience_posts", {
      author_id: args.author,
      caption: args.caption,
      status: "published",
      post_type: "experience",
      visibility: args.visibility ?? "public",
      verification_status: "unverified",
      moderation_status: args.moderation ?? "approved",
      like_count: 0,
      comment_count: 0,
      share_count: 0,
      save_count: 0,
      published_at: args.publishedAt ?? Date.now(),
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: args.deleted ? Date.now() : undefined,
    });
  });
}

describe("feed visibility", () => {
  it("shows public posts to guests and hides followers/private/hidden/deleted", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const author = await insertPerson(t, "author_public");
    const publicId = await insertPost(t, { author: author.profile, caption: "public cafe morning" });
    await insertPost(t, { author: author.profile, caption: "followers only", visibility: "followers" });
    await insertPost(t, { author: author.profile, caption: "private diary", visibility: "private" });
    await insertPost(t, { author: author.profile, caption: "hidden by mods", moderation: "hidden" });
    await insertPost(t, { author: author.profile, caption: "deleted post", deleted: true });

    const page = await t.query(api.feed.page, { type: "for_you" });
    expect(page.posts.map((post) => post.id)).toEqual([publicId]);
    expect(page.followingEmpty).toBe(false);

    expect(await t.query(api.feed.byId, { id: publicId })).not.toBeNull();
    const followerId = await t.run(async (ctx) => {
      const rows = await ctx.db.query("experience_posts").collect();
      return rows.find((row) => row.caption === "followers only")!._id;
    });
    expect(await t.query(api.feed.byId, { id: followerId })).toBeNull();
  });

  it("lets a follower see followers-only posts and respects blocks", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const author = await insertPerson(t, "author_follow");
    const follower = await insertPerson(t, "reader_follow");
    const stranger = await insertPerson(t, "stranger_follow");
    const followersOnly = await insertPost(t, {
      author: author.profile,
      caption: "only my people",
      visibility: "followers",
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("follows", {
        follower_id: follower.profile,
        following_id: author.profile,
        pair_key: pairKey(follower.profile, author.profile),
        created_at: Date.now(),
      });
    });

    const followerClient = t.withIdentity({ subject: `${follower.authUser}|s-follow` });
    const strangerClient = t.withIdentity({ subject: `${stranger.authUser}|s-stranger` });
    expect(await followerClient.query(api.feed.byId, { id: followersOnly })).not.toBeNull();
    expect(await strangerClient.query(api.feed.byId, { id: followersOnly })).toBeNull();

    const followingPage = await followerClient.query(api.feed.page, { type: "following" });
    expect(followingPage.followingEmpty).toBe(false);
    expect(followingPage.posts.some((post) => post.id === followersOnly)).toBe(true);

    await t.run(async (ctx) => {
      await ctx.db.insert("user_blocks", {
        blocker_id: follower.profile,
        blocked_id: author.profile,
        pair_key: pairKey(follower.profile, author.profile),
        created_at: Date.now(),
      });
    });
    expect(await followerClient.query(api.feed.byId, { id: followersOnly })).toBeNull();
  });

  it("does not leak a private post except to its author", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const author = await insertPerson(t, "author_private");
    const other = await insertPerson(t, "other_private");
    const privateId = await insertPost(t, {
      author: author.profile,
      caption: "secret note",
      visibility: "private",
    });
    const authorClient = t.withIdentity({ subject: `${author.authUser}|s-author` });
    const otherClient = t.withIdentity({ subject: `${other.authUser}|s-other` });
    expect(await authorClient.query(api.feed.byId, { id: privateId })).not.toBeNull();
    expect(await otherClient.query(api.feed.byId, { id: privateId })).toBeNull();
    const feed = await t.query(api.feed.page, { type: "for_you" });
    expect(feed.posts.some((post) => post.id === privateId)).toBe(false);
  });
});

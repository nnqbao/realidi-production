import { describe, expect, it } from "vitest";
import { api } from "@/convex/_generated/api";
import { seedDatabase } from "@/convex/seed";
import { pairKey } from "@/convex/_lib/uniqueness";
import { authHarness } from "./auth-harness";

async function insertPerson(
  t: ReturnType<typeof authHarness>,
  opts: {
    email: string;
    username: string;
    displayName?: string;
    banned?: boolean;
    deleted?: boolean;
  },
) {
  return await t.run(async (ctx) => {
    const authUser = await ctx.db.insert("users", {
      email: opts.email,
      emailVerificationTime: 1,
    });
    const profile = await ctx.db.insert("profiles", {
      auth_user_id: authUser,
      username: opts.username,
      display_name: opts.displayName ?? opts.username,
      role: "user",
      locale: "vi",
      timezone: "Asia/Ho_Chi_Minh",
      show_activity_status: true,
      created_at: 1,
      updated_at: 1,
      banned_at: opts.banned ? 1 : undefined,
      deleted_at: opts.deleted ? 1 : undefined,
    });
    return { authUser, profile };
  });
}

describe("search reads", () => {
  it("matches places by accent-insensitive and case-insensitive text", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const [plain, accent, upper] = await Promise.all([
      t.query(api.search.places, { query: "cong" }),
      t.query(api.search.places, { query: "cộng" }),
      t.query(api.search.places, { query: "CỘNG" }),
    ]);
    expect(plain.length).toBeGreaterThan(0);
    expect(plain.map((place) => place.slug).sort()).toEqual(accent.map((place) => place.slug).sort());
    expect(plain.map((place) => place.slug).sort()).toEqual(upper.map((place) => place.slug).sort());
    expect(plain.some((place) => place.slug.includes("cong"))).toBe(true);
  });

  it("hides banned, deleted, and blocked people", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const viewer = await insertPerson(t, { email: "viewer@test.dev", username: "viewer_one" });
    const visible = await insertPerson(t, { email: "visible@test.dev", username: "lan_visible", displayName: "Lan Visible" });
    await insertPerson(t, { email: "banned@test.dev", username: "lan_banned", displayName: "Lan Banned", banned: true });
    await insertPerson(t, { email: "deleted@test.dev", username: "lan_deleted", displayName: "Lan Deleted", deleted: true });
    const blocked = await insertPerson(t, { email: "blocked@test.dev", username: "lan_blocked", displayName: "Lan Blocked" });
    await t.run(async (ctx) => {
      await ctx.db.insert("user_blocks", {
        blocker_id: viewer.profile,
        blocked_id: blocked.profile,
        pair_key: pairKey(viewer.profile, blocked.profile),
        created_at: 1,
      });
    });

    const guestHits = await t.query(api.search.people, { query: "lan" });
    expect(guestHits.map((row) => row.username).sort()).toEqual(["lan_blocked", "lan_visible"]);

    const client = t.withIdentity({ subject: `${viewer.authUser}|session-viewer` });
    const viewerHits = await client.query(api.search.people, { query: "lan" });
    expect(viewerHits.map((row) => row.username)).toEqual(["lan_visible"]);
    expect(viewerHits.some((row) => row.id === visible.profile)).toBe(true);
  });
});

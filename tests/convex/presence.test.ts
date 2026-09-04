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

describe("presence", () => {
  it("heartbeats last_active_at and hides status when privacy is off", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const a = await insertPerson(t, "pres_a");
    const b = await insertPerson(t, "pres_b");
    const alice = t.withIdentity({ subject: `${a.authUser}|s-pa` });
    const bob = t.withIdentity({ subject: `${b.authUser}|s-pb` });

    await alice.mutation(api.presence.heartbeat, {});
    const visible = await bob.query(api.presence.snapshot, { userIds: [a.profile] });
    expect(visible[0]?.status).toBe("online");
    expect(visible[0]?.lastActiveAt).toBeTruthy();

    await alice.mutation(api.profiles.setActivityStatus, { enabled: false });
    const hidden = await bob.query(api.presence.snapshot, { userIds: [a.profile] });
    expect(hidden[0]).toEqual({ userId: a.profile, status: "hidden", lastActiveAt: null });
  });

  it("hides last-active from a blocked peer", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const a = await insertPerson(t, "pres_block_a");
    const b = await insertPerson(t, "pres_block_b");
    const alice = t.withIdentity({ subject: `${a.authUser}|s-pba` });
    const bob = t.withIdentity({ subject: `${b.authUser}|s-pbb` });
    await alice.mutation(api.presence.heartbeat, {});
    await t.run(async (ctx) => {
      await ctx.db.insert("user_blocks", {
        blocker_id: a.profile,
        blocked_id: b.profile,
        pair_key: pairKey(a.profile, b.profile),
        created_at: Date.now(),
      });
    });
    const snap = await bob.query(api.presence.snapshot, { userIds: [a.profile] });
    expect(snap[0]?.status).toBe("hidden");
    expect(snap[0]?.lastActiveAt).toBeNull();
  });
});

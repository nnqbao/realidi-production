import { describe, expect, it } from "vitest";
import { api } from "@/convex/_generated/api";
import { seedDatabase } from "@/convex/seed";
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

describe("safety blocks", () => {
  it("blocks new messaging without deleting history", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const a = await insertPerson(t, "safe_a");
    const b = await insertPerson(t, "safe_b");
    const alice = t.withIdentity({ subject: `${a.authUser}|s-sa` });
    const bob = t.withIdentity({ subject: `${b.authUser}|s-sb` });
    const conversationId = await alice.mutation(api.messages.getOrCreateDirect, { userId: b.profile });
    const saved = await alice.mutation(api.messages.send, { conversationId, body: "trước khi chặn" });

    expect(await alice.mutation(api.safety.block, { userId: b.profile })).toEqual({ blocked: true });
    expect(await alice.query(api.safety.blockedWith, { userId: b.profile })).toEqual({
      blockedByMe: true,
      blocked: true,
    });
    await expect(alice.mutation(api.messages.send, { conversationId, body: "sau khi chặn" })).rejects.toThrow();
    await expect(bob.mutation(api.messages.send, { conversationId, body: "bob cũng không gửi được" })).rejects.toThrow();
    await expect(alice.mutation(api.messages.getOrCreateDirect, { userId: b.profile })).rejects.toThrow();

    const thread = await alice.query(api.messages.thread, { conversationId });
    expect(thread.messages.map((row) => row.id)).toEqual([saved.id]);
    expect(thread.blocked).toBe(true);
    expect(thread.blockedByMe).toBe(true);

    expect(await alice.mutation(api.safety.unblock, { userId: b.profile })).toEqual({ blocked: false });
    const again = await alice.mutation(api.messages.send, { conversationId, body: "bỏ chặn rồi" });
    expect(again.body).toBe("bỏ chặn rồi");
  });

  it("rejects a self-block", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const a = await insertPerson(t, "safe_self");
    const alice = t.withIdentity({ subject: `${a.authUser}|s-self` });
    await expect(alice.mutation(api.safety.block, { userId: a.profile })).rejects.toThrow();
  });
});

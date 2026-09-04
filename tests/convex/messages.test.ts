import { describe, expect, it } from "vitest";
import { api, internal } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
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

describe("messages", () => {
  it("creates a unique direct conversation and rejects self-DM", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const a = await insertPerson(t, "msg_a");
    const b = await insertPerson(t, "msg_b");
    const alice = t.withIdentity({ subject: `${a.authUser}|s-a` });
    const bob = t.withIdentity({ subject: `${b.authUser}|s-b` });

    await expect(alice.mutation(api.messages.getOrCreateDirect, { userId: a.profile })).rejects.toThrow();
    const first = await alice.mutation(api.messages.getOrCreateDirect, { userId: b.profile });
    const second = await alice.mutation(api.messages.getOrCreateDirect, { userId: b.profile });
    const fromBob = await bob.mutation(api.messages.getOrCreateDirect, { userId: a.profile });
    expect(first).toBe(second);
    expect(first).toBe(fromBob);
  });

  it("dedupes optimistic sends and hydrates the saved message", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const a = await insertPerson(t, "msg_dedupe_a");
    const b = await insertPerson(t, "msg_dedupe_b");
    const alice = t.withIdentity({ subject: `${a.authUser}|s-da` });
    const conversationId = await alice.mutation(api.messages.getOrCreateDirect, { userId: b.profile });
    const first = await alice.mutation(api.messages.send, {
      conversationId,
      body: "xin chào",
      clientId: "client-1",
    });
    const second = await alice.mutation(api.messages.send, {
      conversationId,
      body: "khác rồi",
      clientId: "client-1",
    });
    expect(second.id).toBe(first.id);
    expect(second.body).toBe("xin chào");
    const thread = await alice.query(api.messages.thread, { conversationId });
    expect(thread.messages).toHaveLength(1);
  });

  it("rejects a non-member and a reply from another conversation", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const a = await insertPerson(t, "msg_mem_a");
    const b = await insertPerson(t, "msg_mem_b");
    const c = await insertPerson(t, "msg_mem_c");
    const alice = t.withIdentity({ subject: `${a.authUser}|s-ma` });
    const carol = t.withIdentity({ subject: `${c.authUser}|s-mc` });
    const conversationId = await alice.mutation(api.messages.getOrCreateDirect, { userId: b.profile });
    const saved = await alice.mutation(api.messages.send, { conversationId, body: "chỉ hai người" });
    await expect(carol.query(api.messages.thread, { conversationId })).rejects.toThrow();
    await expect(carol.mutation(api.messages.send, { conversationId, body: "xen vào" })).rejects.toThrow();
    await expect(carol.query(api.messages.byId, { messageId: saved.id as Id<"messages"> })).resolves.toBeNull();

    const other = await alice.mutation(api.messages.getOrCreateDirect, { userId: c.profile });
    await expect(
      alice.mutation(api.messages.send, {
        conversationId: other,
        body: "reply lệch thread",
        replyToMessageId: saved.id as Id<"messages">,
      }),
    ).rejects.toThrow();
  });

  it("toggles a reaction and keeps invite response on the same message", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const a = await insertPerson(t, "msg_react_a");
    const b = await insertPerson(t, "msg_react_b");
    const alice = t.withIdentity({ subject: `${a.authUser}|s-ra` });
    const bob = t.withIdentity({ subject: `${b.authUser}|s-rb` });
    const conversationId = await alice.mutation(api.messages.getOrCreateDirect, { userId: b.profile });
    const saved = await alice.mutation(api.messages.send, { conversationId, body: "đi cafe?" });
    expect(await bob.mutation(api.messages.toggleReaction, { messageId: saved.id as Id<"messages">, reaction: "❤️" })).toEqual({
      reaction: "❤️",
    });
    expect(await bob.mutation(api.messages.toggleReaction, { messageId: saved.id as Id<"messages">, reaction: "❤️" })).toEqual({
      reaction: null,
    });

    const place = await t.run(async (ctx) => ctx.db.query("places").first());
    expect(place).not.toBeNull();
    const invited = await alice.mutation(api.messages.inviteToPlace, {
      placeId: place!._id,
      toUserId: b.profile,
      note: "cuối tuần này",
    });
    expect(invited).toBe(conversationId);
    const thread = await bob.query(api.messages.thread, { conversationId });
    const invite = thread.messages.find((row) => row.kind === "invite");
    expect(invite?.invite?.status).toBe("pending");
    await bob.mutation(api.messages.respondToInvite, {
      invitationId: invite!.invite!.invitationId as never,
      messageId: invite!.id as never,
      status: "accepted",
    });
    const after = await bob.query(api.messages.thread, { conversationId });
    expect(after.messages.find((row) => row.id === invite?.id)?.invite?.status).toBe("accepted");
  });

  it("surfaces typing until the expired row is cleaned up", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const a = await insertPerson(t, "msg_type_a");
    const b = await insertPerson(t, "msg_type_b");
    const alice = t.withIdentity({ subject: `${a.authUser}|s-ta` });
    const bob = t.withIdentity({ subject: `${b.authUser}|s-tb` });
    const conversationId = await alice.mutation(api.messages.getOrCreateDirect, { userId: b.profile });
    await alice.mutation(api.messages.setTyping, { conversationId, sessionKey: "tab-1" });
    expect((await bob.query(api.messages.thread, { conversationId })).typing).toBe(true);
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("conversation_typing").collect();
      for (const row of rows) await ctx.db.patch(row._id, { expires_at: Date.now() - 1 });
    });
    await t.mutation(internal.presence.cleanupTyping, {});
    expect((await bob.query(api.messages.thread, { conversationId })).typing).toBe(false);
  });

  it("does not give outsiders a private image URL", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const a = await insertPerson(t, "msg_img_a");
    const b = await insertPerson(t, "msg_img_b");
    const c = await insertPerson(t, "msg_img_c");
    const alice = t.withIdentity({ subject: `${a.authUser}|s-ia` });
    const carol = t.withIdentity({ subject: `${c.authUser}|s-ic` });
    const conversationId = await alice.mutation(api.messages.getOrCreateDirect, { userId: b.profile });
    const storageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" })),
    );
    await alice.mutation(api.files.finalize, {
      storageId,
      purpose: "message",
      mimeType: "image/jpeg",
      byteSize: 4,
    });
    const sent = await alice.mutation(api.messages.send, {
      conversationId,
      kind: "image",
      payload: { storageId },
    });
    expect(sent.imageUrl).toBeTruthy();
    expect(await carol.query(api.messages.byId, { messageId: sent.id as Id<"messages"> })).toBeNull();
  });
});

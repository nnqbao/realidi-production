import { describe, expect, it } from "vitest";
import { api, internal } from "@/convex/_generated/api";
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

describe("storage", () => {
  it("requires a verified profile to mint an upload URL", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    await expect(t.mutation(api.files.generateUploadUrl, { purpose: "experience" })).rejects.toThrow();
  });

  it("finalizes an image and rejects a non-media type", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const person = await insertPerson(t, "uploader");
    const client = t.withIdentity({ subject: `${person.authUser}|s-up` });
    const imageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" })),
    );
    const ready = await client.mutation(api.files.finalize, {
      storageId: imageId,
      purpose: "experience",
      mimeType: "image/jpeg",
      byteSize: 4,
    });
    expect(ready.processingStatus).toBe("ready");
    expect(ready.mediaType).toBe("image");

    const exeId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob([new Uint8Array([0x4d, 0x5a])], { type: "application/x-msdownload" })),
    );
    await expect(
      client.mutation(api.files.finalize, {
        storageId: exeId,
        purpose: "experience",
        mimeType: "application/x-msdownload",
        byteSize: 2,
      }),
    ).rejects.toThrow();
  });

  it("forbids deleting another author's attached media", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const author = await insertPerson(t, "media_owner");
    const stranger = await insertPerson(t, "media_thief");
    const authorClient = t.withIdentity({ subject: `${author.authUser}|s-mo` });
    const strangerClient = t.withIdentity({ subject: `${stranger.authUser}|s-mt` });
    const storageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" })),
    );
    await authorClient.mutation(api.experiences.create, {
      caption: "có ảnh",
      moodRatings: [],
      mediaStorageIds: [storageId],
    });
    await expect(strangerClient.mutation(api.files.remove, { storageId })).rejects.toThrow();
    const stillThere = await t.run(async (ctx) => ctx.db.system.get(storageId));
    expect(stillThere).not.toBeNull();
  });

  it("cleans unreferenced uploads and keeps attached ones", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const author = await insertPerson(t, "orphan");
    const client = t.withIdentity({ subject: `${author.authUser}|s-or` });
    const kept = await t.run(async (ctx) =>
      ctx.storage.store(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" })),
    );
    const orphan = await t.run(async (ctx) =>
      ctx.storage.store(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" })),
    );
    await client.mutation(api.experiences.create, {
      caption: "giữ ảnh",
      moodRatings: [],
      mediaStorageIds: [kept],
    });
    const result = await t.mutation(internal.files.cleanupOrphans, { olderThanMs: 0 });
    expect(result.deleted).toBeGreaterThanOrEqual(1);
    expect(await t.run(async (ctx) => ctx.db.system.get(kept))).not.toBeNull();
    expect(await t.run(async (ctx) => ctx.db.system.get(orphan))).toBeNull();
  });
});

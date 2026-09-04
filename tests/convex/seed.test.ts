import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "@/convex/schema";
import { SEED_CHECKSUM, seedDatabase } from "@/convex/seed";

const modules = {
  "../../convex/_generated/server.ts": async () => ({}),
  "../../convex/seed.ts": () => import("@/convex/seed"),
};
const runSeed = makeFunctionReference<"mutation">("seed:runAuthorized");
const seedStatus = makeFunctionReference<"query">("seed:statusAuthorized");

describe("foundation seed", () => {
  it("seeds SQL taxonomy/config/editorial data and is idempotent", async () => {
    const t = convexTest(schema, modules);
    const first = await t.run(seedDatabase);
    expect(first.logical_inserts).toBeGreaterThan(0);
    expect(first.counts).toEqual({
      moods: 13, experience_styles: 8, place_categories: 10, places: 22,
      place_moods: 44, place_styles: 24, ranking_config: 1,
      feed_ranking_config: 1, feature_flags: 6,
    });
    expect(first.checksum).toBe(SEED_CHECKSUM);

    const second = await t.run(seedDatabase);
    expect(second.logical_inserts).toBe(0);
    expect(second.logical_updates).toBe(0);
    expect(second.checksum).toBe(first.checksum);

    await t.run(async (ctx) => {
      expect(await ctx.db.query("places").collect()).toHaveLength(22);
      expect(await ctx.db.query("moods").collect()).toHaveLength(13);
      expect(await ctx.db.query("place_moods").collect()).toHaveLength(44);
      expect(await ctx.db.query("place_styles").collect()).toHaveLength(24);
      const places = await ctx.db.query("places")
        .withIndex("by_status_city", (query) =>
          query.eq("status", "active").eq("city", "TP. Hồ Chí Minh"))
        .collect();
      expect(places).toHaveLength(22);
      expect(places.every((place) =>
        Number.isSafeInteger(place.latitude_e6) &&
        Number.isSafeInteger(place.longitude_e6))).toBe(true);
    });
  });

  it("authorizes every public seed function and rejects adjacent roles", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(runSeed, {})).rejects.toThrow();
    await expect(t.query(seedStatus, {})).rejects.toThrow();

    for (const role of ["user", "creator", "moderator"] as const) {
      const authUserId = await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          email: `${role}@example.test`, emailVerificationTime: 1,
        });
        await ctx.db.insert("profiles", {
          auth_user_id: userId, username: `seed_${role}`, display_name: role,
          role, locale: "vi", timezone: "Asia/Ho_Chi_Minh", show_activity_status: true,
          created_at: 1, updated_at: 1,
        });
        return userId;
      });
      const caller = t.withIdentity({ subject: `${authUserId}|session-${role}` });
      await expect(caller.mutation(runSeed, {})).rejects.toThrow();
      await expect(caller.query(seedStatus, {})).rejects.toThrow();
    }

    const editorId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        email: "editor@example.test", emailVerificationTime: 1,
      });
      await ctx.db.insert("profiles", {
        auth_user_id: userId, username: "seed_editor", display_name: "Editor",
        role: "editor", locale: "vi", timezone: "Asia/Ho_Chi_Minh",
        show_activity_status: true, created_at: 1, updated_at: 1,
      });
      return userId;
    });
    const editor = t.withIdentity({ subject: `${editorId}|editor-session` });
    const result = await editor.mutation(runSeed, {});
    expect(result.counts.places).toBe(22);
    const firstStatus = await editor.query(seedStatus, {});
    expect(firstStatus.complete).toBe(true);
    const second = await editor.mutation(runSeed, {});
    expect(second.logical_inserts).toBe(0);
    expect(second.logical_updates).toBe(0);
    expect(await editor.query(seedStatus, {})).toEqual(firstStatus);
  });
});

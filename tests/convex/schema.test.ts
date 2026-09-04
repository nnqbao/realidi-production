import { readFileSync } from "node:fs";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "@/convex/schema";

const testModules = {
  "../../convex/_generated/server.ts": async () => ({}),
};

const TABLES = [
  "profiles","user_preferences","moods","experience_styles","place_categories","places",
  "place_moods","place_styles","experience_posts","post_media","experience_mood_ratings",
  "experience_metrics","place_mood_stats","place_experience_stats","place_crowd_stats",
  "place_cost_stats","place_time_stats","travel_dna_profiles","creator_reputation",
  "saved_collections","saves","visit_claims","visit_verifications","follows","post_likes",
  "comments","shares","reports","moderation_actions","ranking_config","feature_flags",
  "product_events","saved_posts","notifications","feed_ranking_config",
  "place_recommendation_feedback","community_question_meta","user_interest_signals",
  "conversations","conversation_participants","messages","conversation_typing",
  "place_invitations","message_reactions","user_blocks","auth_lockouts","user_hidden_posts",
  "place_media","audit_logs","editorial_collections","editorial_collection_items",
  "featured_placements",
] as const;

describe("Convex schema", () => {
  it("defines all 52 active domain tables with concrete validators", () => {
    expect(TABLES).toHaveLength(52);
    const source = readFileSync("convex/schema.ts", "utf8");
    for (const table of TABLES) {
      expect(source).toContain(`${table}: defineTable`);
    }
    expect(source).not.toMatch(/\bv\.any\s*\(/);
  });

  it("rejects malformed documents and supports named indexes", async () => {
    const t = convexTest(schema, testModules);
    await expect(t.run(async (ctx) => {
      await ctx.db.insert("moods", {
        seed_key: "bad",
        slug: "bad",
        layer: "not-a-layer",
      } as never);
    })).rejects.toThrow();

    await t.run(async (ctx) => {
      await ctx.db.insert("moods", {
        seed_key: "mood:test", slug: "test", layer: "desired_feeling",
        name_vi: "Thử", name_en: "Test", color_token: "mood-test",
        is_active: true, sort_order: 1, created_at: 0, updated_at: 0,
      });
      const row = await ctx.db.query("moods")
        .withIndex("by_slug", (query) => query.eq("slug", "test")).unique();
      expect(row?.seed_key).toBe("mood:test");
    });
  });
});

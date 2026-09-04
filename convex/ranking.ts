import { query } from "./_generated/server";
import { rankingConfigFromDoc } from "./catalog";

export const config = query({
  args: {},
  handler: async (ctx) => {
    const doc = await ctx.db
      .query("ranking_config")
      .withIndex("by_seed_key", (q) => q.eq("seed_key", "ranking:default"))
      .unique();
    return doc ? rankingConfigFromDoc(doc) : null;
  },
});

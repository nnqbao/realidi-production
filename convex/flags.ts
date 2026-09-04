import { query } from "./_generated/server";

export const all = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("feature_flags").collect();
    return Object.fromEntries(rows.map((row) => [row.key, row.enabled]));
  },
});

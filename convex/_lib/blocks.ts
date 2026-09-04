import type { GenericMutationCtx, GenericQueryCtx } from "convex/server";
import type { DataModel } from "../_generated/dataModel";
import type { Id } from "../_generated/dataModel";
import { pairKey } from "./uniqueness";

type Ctx = GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>;

export async function areBlocked(
  ctx: Ctx,
  left: Id<"profiles">,
  right: Id<"profiles">,
): Promise<boolean> {
  const outgoing = await ctx.db
    .query("user_blocks")
    .withIndex("by_pair", (q) => q.eq("pair_key", pairKey(left, right)))
    .unique();
  const incoming = await ctx.db
    .query("user_blocks")
    .withIndex("by_pair", (q) => q.eq("pair_key", pairKey(right, left)))
    .unique();
  return outgoing !== null || incoming !== null;
}

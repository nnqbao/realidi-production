import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { optionalIdentity } from "./authz";
import { areBlocked } from "./blocks";

export type NotifyType =
  | "new_follower"
  | "post_like"
  | "post_comment"
  | "comment_reply"
  | "post_saved"
  | "verified_visit"
  | "system"
  | "message"
  | "community_answer"
  | "place_invite";

function notifyKey(input: {
  type: NotifyType;
  actorId: string;
  recipientId: string;
  postId?: string;
  commentId?: string;
  messageId?: string;
}): string | null {
  switch (input.type) {
    case "message":
      return input.messageId ? `message:${input.messageId}` : null;
    case "post_like":
      return input.postId ? `like:${input.postId}:${input.actorId}` : null;
    case "post_saved":
      return input.postId ? `save:${input.postId}:${input.actorId}` : null;
    case "post_comment":
    case "comment_reply":
    case "community_answer":
      return input.commentId ? `comment:${input.commentId}` : null;
    case "new_follower":
      return `follow:${input.actorId}:${input.recipientId}`;
    case "place_invite":
      return null;
    default:
      return null;
  }
}

export async function notifyEvent(
  ctx: MutationCtx,
  args: {
    recipientId: Id<"profiles">;
    type: NotifyType;
    postId?: Id<"experience_posts">;
    commentId?: Id<"comments">;
    messageId?: Id<"messages">;
    metadata?: Record<string, string | number | boolean | null>;
  },
): Promise<{ id: string | null; duplicate: boolean }> {
  const identity = await optionalIdentity(ctx);
  const actorId = identity?.profile._id;
  if (actorId === undefined || actorId === args.recipientId) {
    return { id: null, duplicate: false };
  }
  if (args.type === "message" && args.messageId === undefined) {
    return { id: null, duplicate: false };
  }
  if (await areBlocked(ctx, actorId, args.recipientId)) {
    return { id: null, duplicate: false };
  }
  const key = notifyKey({
    type: args.type,
    actorId,
    recipientId: args.recipientId,
    postId: args.postId,
    commentId: args.commentId,
    messageId: args.messageId,
  });
  if (key) {
    const existing = await ctx.db
      .query("notifications")
      .withIndex("by_idempotency_key", (q) => q.eq("idempotency_key", key))
      .unique();
    if (existing) return { id: existing._id, duplicate: true };
  }
  const id = await ctx.db.insert("notifications", {
    user_id: args.recipientId,
    actor_id: actorId,
    type: args.type,
    post_id: args.postId,
    comment_id: args.commentId,
    message_id: args.messageId,
    idempotency_key: key ?? undefined,
    metadata: args.metadata ?? {},
    created_at: Date.now(),
  });
  return { id, duplicate: false };
}

"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { convexMutation } from "@/lib/convex/server";
import { requireUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/security/rate-limit";
import { trackEvent } from "@/lib/analytics";
import type { SaveIntent } from "@/types/database";
import { reportSchema } from "@/lib/validation";

function flatProperties(
  properties: Record<string, string | number | boolean | null | undefined>,
): Record<string, string | number | boolean | null> {
  return Object.fromEntries(
    Object.entries(properties)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, value as string | number | boolean | null]),
  );
}

export async function recordProductEvent(
  eventName: string,
  properties: Record<string, string | number | boolean | null | undefined> = {},
  sessionId?: string | null,
) {
  const flat = flatProperties(properties);
  try {
    await convexMutation(api.analytics.recordEvent, {
      eventName,
      sessionId: sessionId ?? undefined,
      properties: flat,
    });
  } catch {
    // Analytics is best-effort and also used by guests.
  }
  await trackEvent(eventName as never, properties, { sessionId });
}

export async function toggleSavePlace(placeId: string, intent: SaveIntent = "saved") {
  const { user } = await requireUser();
  if (!rateLimit(`save:${user.id}`, 40)) {
    throw new Error("RATE_LIMIT");
  }
  const result = await convexMutation(api.places.toggleSave, {
    placeId: placeId as Id<"places">,
    intent,
  });
  try {
    if (!result.saved) await recordProductEvent("place_unsaved", { place_id: placeId });
    else if (intent === "want_to_go") await recordProductEvent("saved_place", { place_id: placeId, intent: "want_to_go" });
    else {
      await recordProductEvent("place_saved", { place_id: placeId, intent });
      await recordProductEvent("saved_place", { place_id: placeId, intent });
    }
  } catch {
    // Analytics must not block the save toggle.
  }
  revalidatePath("/saved");
  return { saved: result.saved, intent: result.intent as SaveIntent | null };
}

export async function toggleBeenThere(placeId: string) {
  const { user } = await requireUser();
  if (!rateLimit(`been:${user.id}`, 20)) throw new Error("RATE_LIMIT");
  const result = await convexMutation(api.social.toggleBeenThere, {
    placeId: placeId as Id<"places">,
  });
  if (result.beenThere) {
    await recordProductEvent("been_there_clicked", { place_id: placeId });
    await recordProductEvent("been_there", { place_id: placeId });
  }
  revalidatePath("/");
  return { beenThere: result.beenThere };
}

export async function recordShare(input: { placeId?: string; postId?: string }) {
  await convexMutation(api.social.recordShare, {
    placeId: input.placeId as Id<"places"> | undefined,
    postId: input.postId as Id<"experience_posts"> | undefined,
  });
  await recordProductEvent("post_shared", {
    place_id: input.placeId ?? null,
    post_id: input.postId ?? null,
  });
}

export async function toggleFollow(userId: string) {
  const { user } = await requireUser();
  if (user.id === userId) return { following: false };
  const result = await convexMutation(api.social.toggleFollow, {
    userId: userId as Id<"profiles">,
  });
  await recordProductEvent(result.following ? "user_followed" : "user_unfollowed", {
    target_user_id: userId,
  });
  if (result.following) await recordProductEvent("follow_clicked", { target_user_id: userId });
  revalidatePath("/home");
  return { following: result.following };
}

export async function toggleLike(postId: string) {
  await requireUser();
  const result = await convexMutation(api.social.toggleLike, {
    postId: postId as Id<"experience_posts">,
  });
  await recordProductEvent(result.liked ? "post_liked" : "post_unliked", { post_id: postId });
  return { liked: result.liked };
}

export async function toggleSavePost(postId: string) {
  await requireUser();
  const result = await convexMutation(api.social.toggleSavePost, {
    postId: postId as Id<"experience_posts">,
  });
  await recordProductEvent(result.saved ? "post_saved" : "post_unsaved", { post_id: postId });
  revalidatePath("/saved");
  return { saved: result.saved };
}

export async function addComment(
  postId: string,
  body: string,
  parentId?: string | null,
  placeId?: string | null,
  attachedPostId?: string | null,
) {
  const { user } = await requireUser();
  if (!rateLimit(`comment:${user.id}`, 20)) throw new Error("RATE_LIMIT");
  const trimmed = body.trim();
  if (trimmed.length < 1 || trimmed.length > 2000) throw new Error("INVALID");
  const result = await convexMutation(api.social.addComment, {
    postId: postId as Id<"experience_posts">,
    body: trimmed,
    parentId: parentId ? (parentId as Id<"comments">) : undefined,
    placeId: placeId ? (placeId as Id<"places">) : undefined,
    attachedPostId: attachedPostId ? (attachedPostId as Id<"experience_posts">) : undefined,
  });
  await recordProductEvent("post_commented", { post_id: postId });
  revalidatePath(`/post/${postId}`);
  revalidatePath(`/experience/${postId}`);
  revalidatePath("/home");
  return { id: result.id, postId: result.postId, body: result.body, authorId: result.authorId };
}

export async function deleteComment(commentId: string) {
  await requireUser();
  await convexMutation(api.social.deleteComment, {
    commentId: commentId as Id<"comments">,
  });
  revalidatePath("/");
}

export async function submitReport(input: {
  targetType: "post" | "comment" | "user" | "place" | "message" | "conversation";
  targetId: string;
  reason: string;
  details?: string;
}) {
  const { user } = await requireUser();
  if (!rateLimit(`report:${user.id}`, 8, 10 * 60_000)) throw new Error("RATE_LIMIT");
  const parsed = reportSchema.safeParse({
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason,
    details: input.details ?? null,
  });
  if (!parsed.success) throw new Error("INVALID");
  const result = await convexMutation(api.social.submitReport, {
    targetType: parsed.data.targetType,
    targetId: parsed.data.targetId,
    reason: parsed.data.reason,
    details: parsed.data.details ?? undefined,
  });
  if (!result.duplicate) {
    await recordProductEvent("report_submitted", {
      target_type: parsed.data.targetType,
      target_id: parsed.data.targetId,
    });
  }
  return { duplicate: result.duplicate };
}

"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { convexMutation } from "@/lib/convex/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { requireUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/security/rate-limit";
import { recordInterestSignal } from "@/lib/signals";
import { trackEvent } from "@/lib/analytics";
import type { SaveIntent } from "@/types/database";
import { insertNotification } from "@/features/notifications/actions";
import { reportSchema } from "@/lib/validation";

export async function recordProductEvent(
  eventName: string,
  properties: Record<string, string | number | boolean | null | undefined> = {},
  sessionId?: string | null,
) {
  if (!isSupabaseConfigured()) return;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("product_events").insert({
    event_name: eventName,
    user_id: user?.id ?? null,
    session_id: sessionId ?? null,
    properties: properties as never,
  });
  await trackEvent(eventName as never, properties, { userId: user?.id, sessionId });
  const entityId =
    (typeof properties.place_id === "string" && properties.place_id) ||
    (typeof properties.post_id === "string" && properties.post_id) ||
    (typeof properties.mood_id === "string" && properties.mood_id) ||
    (typeof properties.target_user_id === "string" && properties.target_user_id) ||
    (typeof properties.profile_id === "string" && properties.profile_id) ||
    null;
  const entityType =
    typeof properties.place_id === "string"
      ? "place"
      : typeof properties.mood_id === "string"
        ? "mood"
        : typeof properties.target_user_id === "string" || typeof properties.profile_id === "string"
          ? "author"
          : typeof properties.post_id === "string"
            ? "post"
            : null;
  if (entityType && entityId) {
    await recordInterestSignal({ entityType, entityId, signalType: eventName }).catch(() => undefined);
  }
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
    // Product analytics still writes through the leftover Supabase path.
  }
  revalidatePath("/saved");
  return { saved: result.saved, intent: result.intent as SaveIntent | null };
}

export async function toggleBeenThere(placeId: string) {
  const { user } = await requireUser();
  if (!rateLimit(`been:${user.id}`, 20)) throw new Error("RATE_LIMIT");
  const supabase = await createServerSupabase();
  const { data: existing } = await supabase
    .from("visit_claims")
    .select("id")
    .eq("user_id", user.id)
    .eq("place_id", placeId)
    .maybeSingle();
  if (existing) {
    await supabase.from("visit_claims").delete().eq("id", existing.id);
    revalidatePath("/");
    return { beenThere: false };
  }
  await supabase.from("visit_claims").insert({ user_id: user.id, place_id: placeId });
  await recordProductEvent("been_there_clicked", { place_id: placeId });
  await recordProductEvent("been_there", { place_id: placeId });
  revalidatePath("/");
  return { beenThere: true };
}

export async function recordShare(input: { placeId?: string; postId?: string }) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("shares").insert({
    user_id: user?.id ?? null,
    place_id: input.placeId ?? null,
    post_id: input.postId ?? null,
    channel: "link",
  });
  await recordProductEvent("post_shared", {
    place_id: input.placeId ?? null,
    post_id: input.postId ?? null,
  });
}

async function notify(input: {
  userId: string;
  actorId: string;
  type: "new_follower" | "post_like" | "post_comment" | "comment_reply" | "post_saved" | "community_answer" | "message" | "place_invite";
  postId?: string | null;
  commentId?: string | null;
}) {
  await insertNotification({
    userId: input.userId,
    actorId: input.actorId,
    type: input.type,
    postId: input.postId,
    commentId: input.commentId,
  });
}

export async function toggleFollow(userId: string) {
  const { user } = await requireUser();
  if (user.id === userId) return { following: false };
  const supabase = await createServerSupabase();
  const { data: existing } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", user.id)
    .eq("following_id", userId)
    .maybeSingle();
  if (existing) {
    await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", userId);
    await recordProductEvent("user_unfollowed", { target_user_id: userId });
    revalidatePath("/home");
    return { following: false };
  }
  await supabase.from("follows").insert({ follower_id: user.id, following_id: userId });
  await notify({ userId, actorId: user.id, type: "new_follower" });
  await recordProductEvent("follow_clicked", { target_user_id: userId });
  await recordProductEvent("user_followed", { target_user_id: userId });
  revalidatePath("/home");
  return { following: true };
}

export async function toggleLike(postId: string) {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  const { data: existing } = await supabase
    .from("post_likes")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("post_id", postId)
    .maybeSingle();
  if (existing) {
    await supabase.from("post_likes").delete().eq("user_id", user.id).eq("post_id", postId);
    await recordProductEvent("post_unliked", { post_id: postId });
    return { liked: false };
  }
  await supabase.from("post_likes").insert({ user_id: user.id, post_id: postId });
  const { data: post } = await supabase.from("experience_posts").select("author_id").eq("id", postId).maybeSingle();
  if (post) await notify({ userId: post.author_id, actorId: user.id, type: "post_like", postId });
  await recordProductEvent("post_liked", { post_id: postId });
  return { liked: true };
}

export async function toggleSavePost(postId: string) {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  const { data: existing } = await supabase
    .from("saved_posts")
    .select("id")
    .eq("user_id", user.id)
    .eq("post_id", postId)
    .maybeSingle();
  if (existing) {
    await supabase.from("saved_posts").delete().eq("id", existing.id);
    await recordProductEvent("post_unsaved", { post_id: postId });
    revalidatePath("/saved");
    return { saved: false };
  }
  await supabase.from("saved_posts").insert({ user_id: user.id, post_id: postId });
  const { data: post } = await supabase.from("experience_posts").select("author_id").eq("id", postId).maybeSingle();
  if (post) await notify({ userId: post.author_id, actorId: user.id, type: "post_saved", postId });
  await recordProductEvent("post_saved", { post_id: postId });
  revalidatePath("/saved");
  return { saved: true };
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
  const supabase = await createServerSupabase();
  const { data: comment, error: commentError } = await supabase
    .from("comments")
    .insert({
      post_id: postId,
      author_id: user.id,
      body: trimmed,
      parent_id: parentId ?? null,
      place_id: placeId ?? null,
      attached_post_id: attachedPostId ?? null,
    })
    .select("id")
    .single();
  if (commentError || !comment) throw new Error(commentError?.message ?? "COMMENT_FAILED");
  const { data: post } = await supabase.from("experience_posts").select("author_id, post_type").eq("id", postId).maybeSingle();
  if (post) {
    await notify({
      userId: post.author_id,
      actorId: user.id,
      type: parentId ? "comment_reply" : post.post_type === "question" ? "community_answer" : "post_comment",
      postId,
      commentId: comment.id,
    });
  }
  await recordProductEvent("post_commented", { post_id: postId });
  if (post?.post_type === "question") {
    await recordProductEvent("community_answer_created", { post_id: postId, comment_id: comment.id });
  }
  if (placeId) {
    await recordProductEvent("place_attached_to_answer", { post_id: postId, place_id: placeId });
  }
  revalidatePath(`/post/${postId}`);
  revalidatePath(`/experience/${postId}`);
  revalidatePath("/home");
  return { id: comment.id, postId, body: trimmed, authorId: user.id };
}

export async function deleteComment(commentId: string) {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  await supabase
    .from("comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId)
    .eq("author_id", user.id);
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
  const supabase = await createServerSupabase();
  const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { data: recent } = await supabase
    .from("reports")
    .select("id")
    .eq("reporter_id", user.id)
    .eq("target_type", parsed.data.targetType)
    .eq("target_id", parsed.data.targetId)
    .gte("created_at", since)
    .maybeSingle();
  if (recent) return { duplicate: true as const };
  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    target_type: parsed.data.targetType,
    target_id: parsed.data.targetId,
    reason: parsed.data.reason,
    details: parsed.data.details ?? null,
    status: "pending",
    priority: parsed.data.reason === "hate" || parsed.data.reason === "harassment" ? "high" : "normal",
  });
  if (error) throw new Error(error.message);
  await recordProductEvent("report_submitted", {
    target_type: parsed.data.targetType,
    target_id: parsed.data.targetId,
  });
  return { duplicate: false as const };
}

"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { requireUser } from "@/lib/auth/session";
import { convexMutation, convexQueryAuthed } from "@/lib/convex/server";

export async function hidePost(postId: string) {
  await requireUser();
  await convexMutation(api.social.hidePost, { postId: postId as Id<"experience_posts"> });
  revalidatePath("/home");
  return { ok: true as const };
}

export async function unhidePost(postId: string) {
  await requireUser();
  await convexMutation(api.social.unhidePost, { postId: postId as Id<"experience_posts"> });
  revalidatePath("/home");
  return { ok: true as const };
}

export async function listBlockedUserIds(): Promise<string[]> {
  const session = await requireUser().catch(() => null);
  if (!session) return [];
  return await convexQueryAuthed(api.social.blockedIds, {});
}

export async function listHiddenPostIds(): Promise<string[]> {
  const session = await requireUser().catch(() => null);
  if (!session) return [];
  return await convexQueryAuthed(api.social.hiddenIds, {});
}

export async function hidePostAndSimilar(postId: string) {
  await hidePost(postId);
}

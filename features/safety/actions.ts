"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

export async function hidePost(postId: string) {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  await supabase.from("user_hidden_posts").upsert({ user_id: user.id, post_id: postId });
  revalidatePath("/home");
  return { ok: true as const };
}

export async function unhidePost(postId: string) {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  await supabase.from("user_hidden_posts").delete().eq("user_id", user.id).eq("post_id", postId);
  revalidatePath("/home");
  return { ok: true as const };
}

export async function listBlockedUserIds(): Promise<string[]> {
  const session = await requireUser().catch(() => null);
  if (!session) return [];
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("user_blocks").select("blocker_id, blocked_id").or(`blocker_id.eq.${session.user.id},blocked_id.eq.${session.user.id}`);
  const ids = new Set<string>();
  for (const row of data ?? []) {
    if (row.blocker_id === session.user.id) ids.add(row.blocked_id);
    else ids.add(row.blocker_id);
  }
  return [...ids];
}

export async function listHiddenPostIds(): Promise<string[]> {
  const session = await requireUser().catch(() => null);
  if (!session) return [];
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("user_hidden_posts").select("post_id").eq("user_id", session.user.id);
  return (data ?? []).map((row) => row.post_id);
}

export async function hidePostAndSimilar(postId: string) {
  await hidePost(postId);
}

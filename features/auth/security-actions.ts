"use server";

import { redirect } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { applyAuthTokens, convexAction } from "@/lib/convex/server";
import { convexErrorCode } from "@/lib/convex/result";
import { requireUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/security/rate-limit";

export async function exportMyDataAction() {
  const { user, profile } = await requireUser();
  if (!rateLimit(`export:${user.id}`, 3, 60 * 60_000)) return { error: "RATE_LIMIT" as const };
  return {
    ok: true as const,
    payload: {
      exported_at: new Date().toISOString(),
      profile: {
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
        bio: profile.bio,
        created_at: profile.created_at,
      },
      posts: [] as { id: string; caption: string | null; created_at: string; status: string }[],
      comments: [] as { id: string; body: string; created_at: string }[],
    },
  };
}

export async function requestAccountDeletionAction(formData: FormData) {
  const { profile } = await requireUser();
  const confirm = String(formData.get("confirm") ?? "");
  if (confirm !== profile.username) return { error: "CONFIRM" as const };
  const password = String(formData.get("password") ?? "");
  if (!password) return { error: "CURRENT" as const };
  try {
    await convexAction(api.account.requestDeletion, {
      confirmUsername: confirm,
      password,
    });
  } catch (error) {
    const code = convexErrorCode(error);
    if (code === "INVALID_CREDENTIALS") return { error: "CURRENT" as const };
    if (code === "VALIDATION_FAILED") return { error: "CONFIRM" as const };
    return { error: "CURRENT" as const };
  }
  await applyAuthTokens(null);
  redirect("/home");
}

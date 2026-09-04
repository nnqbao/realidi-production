"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { convexMutation } from "@/lib/convex/server";
import { requireUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/security/rate-limit";
import { recordProductEvent } from "@/features/social/actions";

export async function submitRecommendationFeedback(input: {
  placeId: string;
  moodId: string | null;
  kind: "fit" | "wrong_mood";
}) {
  const { user } = await requireUser();
  if (!rateLimit(`rec-feedback:${user.id}`, 40)) throw new Error("RATE_LIMIT");
  await convexMutation(api.discovery.submitFeedback, {
    placeId: input.placeId as Id<"places">,
    moodId: input.moodId ? (input.moodId as Id<"moods">) : undefined,
    kind: input.kind,
  });
  try {
    await recordProductEvent("recommendation_feedback", {
      place_id: input.placeId,
      mood_id: input.moodId,
      kind: input.kind,
    });
  } catch {
    // Analytics must not fail the user-facing write.
  }
  revalidatePath("/explore");
}

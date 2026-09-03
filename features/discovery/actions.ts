"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
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
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("place_recommendation_feedback").upsert(
    {
      user_id: user.id,
      place_id: input.placeId,
      mood_id: input.moodId,
      kind: input.kind,
    },
    { onConflict: "user_id,place_id" },
  );
  if (error) throw new Error("FEEDBACK_FAILED");
  await recordProductEvent("recommendation_feedback", {
    place_id: input.placeId,
    mood_id: input.moodId,
    kind: input.kind,
  });
  revalidatePath("/explore");
}

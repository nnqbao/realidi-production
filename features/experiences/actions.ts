"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { experienceCreateSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/security/rate-limit";
import { recordProductEvent } from "@/features/social/actions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createExperienceAction(input: unknown) {
  const { user } = await requireUser();
  if (!rateLimit(`create-exp:${user.id}`, 8, 10 * 60_000)) {
    return { error: "RATE_LIMIT" };
  }
  const parsed = experienceCreateSchema.safeParse(input);
  if (!parsed.success) return { error: "INVALID" };

  const supabase = await createServerSupabase();
  await recordProductEvent("experience_create_started", { place_id: parsed.data.placeId ?? null });

  const { data: post, error } = await supabase
    .from("experience_posts")
    .insert({
      author_id: user.id,
      place_id: parsed.data.placeId ?? null,
      post_type: parsed.data.postType ?? "experience",
      visibility: "public",
      caption: parsed.data.caption ?? null,
      visit_date: parsed.data.visitDate ?? null,
      visit_context: parsed.data.visitContext ?? null,
      status: "published",
      published_at: new Date().toISOString(),
      area_label: parsed.data.areaLabel ?? null,
    })
    .select("id")
    .single();
  if (error || !post) return { error: error?.message ?? "CREATE_FAILED" };

  if (parsed.data.mediaPaths.length) {
    const mediaRows = parsed.data.mediaPaths.map((path, index) => ({
      post_id: post.id,
      media_type: (path.match(/\.(mp4|webm|mov)$/i) ? "video" : "image") as "image" | "video",
      storage_path: path,
      sort_order: index,
    }));
    await supabase.from("post_media").insert(mediaRows);
  }

  if (parsed.data.moodRatings.length) {
    await supabase.from("experience_mood_ratings").insert(
      parsed.data.moodRatings.map((row) => ({
        experience_post_id: post.id,
        mood_id: row.moodId,
        rating: row.rating,
      })),
    );
  }

  if (parsed.data.crowdLevel || parsed.data.worthIt || parsed.data.spendPerPerson) {
    await supabase.from("experience_metrics").insert({
      experience_post_id: post.id,
      crowd_level: parsed.data.crowdLevel ?? null,
      worth_it: parsed.data.worthIt ?? null,
      spend_per_person: parsed.data.spendPerPerson ?? null,
      visit_day_type: parsed.data.visitDayType ?? null,
      visit_time_period: parsed.data.visitTimePeriod ?? null,
    });
  }

  if (parsed.data.postType === "question") {
    await supabase.from("community_question_meta").insert({
      post_id: post.id,
      area_label: parsed.data.areaLabel ?? null,
      budget_max: parsed.data.budgetMax ?? null,
      mood_id: parsed.data.moodRatings[0]?.moodId ?? null,
      visit_context: parsed.data.visitContext ?? null,
      time_label: parsed.data.timeLabel ?? null,
      crowd_preference: parsed.data.crowdPreference ?? null,
    });
    await recordProductEvent("community_question_created", { post_id: post.id });
  }
  if (parsed.data.postType === "community") {
    await recordProductEvent("community_question_created", { post_id: post.id, kind: "community" });
  }
  if (parsed.data.postType === "check_in") {
    await recordProductEvent("checkin_created", { post_id: post.id, place_id: parsed.data.placeId ?? null });
  }
  if (parsed.data.placeId) {
    await supabase.rpc("refresh_place_aggregates", { p_place_id: parsed.data.placeId });
  }
  await recordProductEvent("experience_published", {
    place_id: parsed.data.placeId ?? null,
    post_id: post.id,
  });
  await recordProductEvent("post_created", {
    post_id: post.id,
    author_id: user.id,
    post_type: parsed.data.postType ?? "experience",
  });
  revalidatePath("/home");
  revalidatePath("/explore");
  redirect(`/post/${post.id}`);
}

export async function saveExperienceDraftAction(input: unknown) {
  const { user } = await requireUser();
  const parsed = experienceCreateSchema.safeParse(input);
  if (!parsed.success) return { error: "INVALID" };
  const supabase = await createServerSupabase();
  const { data: post, error } = await supabase
    .from("experience_posts")
    .insert({
      author_id: user.id,
      place_id: parsed.data.placeId ?? null,
      post_type: parsed.data.postType ?? "experience",
      caption: parsed.data.caption ?? null,
      visit_date: parsed.data.visitDate ?? null,
      visit_context: parsed.data.visitContext ?? null,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !post) return { error: error?.message ?? "CREATE_FAILED" };
  return { id: post.id };
}

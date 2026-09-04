"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { requireUser } from "@/lib/auth/session";
import { convexMutation } from "@/lib/convex/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { experienceCreateSchema } from "@/lib/validation";
import { recordProductEvent } from "@/features/social/actions";

function optionalId<Table extends "places" | "moods" | "experience_posts" | "_storage">(
  value: string | null | undefined,
) {
  return value ? (value as Id<Table>) : undefined;
}

function createArgs(parsed: ReturnType<typeof experienceCreateSchema.parse>) {
  return {
    placeId: optionalId<"places">(parsed.placeId),
    postType: parsed.postType,
    caption: parsed.caption ?? undefined,
    visitDate: parsed.visitDate ?? undefined,
    visitContext: parsed.visitContext ?? undefined,
    moodRatings: parsed.moodRatings.map((row) => ({
      moodId: row.moodId as Id<"moods">,
      rating: row.rating,
    })),
    crowdLevel: parsed.crowdLevel ?? undefined,
    worthIt: parsed.worthIt ?? undefined,
    spendPerPerson: parsed.spendPerPerson ?? undefined,
    visitDayType: parsed.visitDayType ?? undefined,
    visitTimePeriod: parsed.visitTimePeriod ?? undefined,
    mediaStorageIds: parsed.mediaStorageIds as Id<"_storage">[],
    areaLabel: parsed.areaLabel ?? undefined,
    budgetMax: parsed.budgetMax ?? undefined,
    timeLabel: parsed.timeLabel ?? undefined,
    crowdPreference: parsed.crowdPreference ?? undefined,
  };
}

export async function generateExperienceUploadUrlAction() {
  await requireUser();
  return await convexMutation(api.files.generateUploadUrl, { purpose: "experience" });
}

export async function finalizeExperienceMediaAction(input: {
  storageId: string;
  mimeType: string;
  byteSize: number;
}) {
  await requireUser();
  return await convexMutation(api.files.finalize, {
    storageId: input.storageId as Id<"_storage">,
    purpose: "experience",
    mimeType: input.mimeType,
    byteSize: input.byteSize,
  });
}

export async function createExperienceAction(input: unknown) {
  const { user } = await requireUser();
  if (!rateLimit(`create-exp:${user.id}`, 8, 10 * 60_000)) {
    return { error: "RATE_LIMIT" };
  }
  const parsed = experienceCreateSchema.safeParse(input);
  if (!parsed.success) return { error: "INVALID" };

  await recordProductEvent("experience_create_started", { place_id: parsed.data.placeId ?? null });
  let result: { id: string };
  try {
    result = await convexMutation(api.experiences.create, createArgs(parsed.data));
  } catch {
    return { error: "CREATE_FAILED" };
  }
  revalidatePath("/home");
  revalidatePath("/explore");
  redirect(`/post/${result.id}`);
}

export async function saveExperienceDraftAction(input: unknown) {
  await requireUser();
  const parsed = experienceCreateSchema.safeParse(input);
  if (!parsed.success) return { error: "INVALID" };
  try {
    const result = await convexMutation(api.experiences.saveDraft, createArgs(parsed.data));
    return { id: result.id };
  } catch {
    return { error: "CREATE_FAILED" };
  }
}

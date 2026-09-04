"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { requireUser } from "@/lib/auth/session";
import { convexMutation } from "@/lib/convex/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { verifyVisitSchema } from "@/lib/validation";
import { recordProductEvent } from "@/features/social/actions";

export async function verifyVisitAction(input: unknown) {
  const { user } = await requireUser();
  if (!rateLimit(`verify:${user.id}`, 10, 10 * 60_000)) {
    return { ok: false as const, error: "RATE_LIMIT" };
  }
  const parsed = verifyVisitSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID" };

  await recordProductEvent("verification_started", { place_id: parsed.data.placeId });
  try {
    const result = await convexMutation(api.verification.verifyVisit, {
      placeId: parsed.data.placeId as Id<"places">,
      experiencePostId: parsed.data.experiencePostId
        ? (parsed.data.experiencePostId as Id<"experience_posts">)
        : undefined,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      accuracyMeters: parsed.data.accuracyMeters ?? undefined,
    });
    revalidatePath("/");
    return {
      ok: true as const,
      result: result.result,
      reason: result.reason,
      confidence: result.confidence,
      distanceMeters: result.distanceMeters,
      verificationId: result.verificationId,
    };
  } catch {
    return { ok: false as const, error: "PLACE_NOT_FOUND" };
  }
}

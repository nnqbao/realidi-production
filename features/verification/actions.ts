"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { verifyVisitSchema } from "@/lib/validation";
import { evaluateGeofence } from "@/lib/geo";
import { getRankingConfig } from "@/features/mood/queries";
import { recordProductEvent } from "@/features/social/actions";
import { rateLimit } from "@/lib/security/rate-limit";
import { revalidatePath } from "next/cache";

export async function verifyVisitAction(input: unknown) {
  const { user } = await requireUser();
  if (!rateLimit(`verify:${user.id}`, 10, 10 * 60_000)) {
    return { ok: false as const, error: "RATE_LIMIT" };
  }
  const parsed = verifyVisitSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID" };

  const supabase = await createServerSupabase();
  const { data: place } = await supabase
    .from("places")
    .select("id, latitude, longitude, slug")
    .eq("id", parsed.data.placeId)
    .maybeSingle();
  if (!place || place.latitude == null || place.longitude == null) {
    return { ok: false as const, error: "PLACE_NOT_FOUND" };
  }

  const config = await getRankingConfig();
  await recordProductEvent("verification_started", { place_id: place.id });

  const geofence = evaluateGeofence({
    userLatitude: parsed.data.latitude,
    userLongitude: parsed.data.longitude,
    placeLatitude: place.latitude,
    placeLongitude: place.longitude,
    radiusMeters: config.geofenceRadiusMeters,
    accuracyMeters: parsed.data.accuracyMeters,
  });

  const verifiedAt = geofence.result === "verified" ? new Date().toISOString() : null;
  const { data: verification, error } = await supabase
    .from("visit_verifications")
    .insert({
      user_id: user.id,
      place_id: place.id,
      experience_post_id: parsed.data.experiencePostId ?? null,
      method: "onsite_geolocation",
      result: geofence.result,
      confidence: geofence.confidence,
      distance_meters: Number.isFinite(geofence.distanceMeters) ? geofence.distanceMeters : null,
      accuracy_meters: parsed.data.accuracyMeters ?? null,
      geofence_radius_meters: config.geofenceRadiusMeters,
      verified_at: verifiedAt,
      metadata: {
        accuracy_class: geofence.reason,
        // Do not persist raw user coordinates.
      },
    })
    .select("id, result, confidence, distance_meters")
    .single();

  if (error) return { ok: false as const, error: error.message };

  if (geofence.result === "verified") {
    if (parsed.data.experiencePostId) {
      await supabase
        .from("experience_posts")
        .update({ verification_status: "verified" })
        .eq("id", parsed.data.experiencePostId)
        .eq("author_id", user.id);
    }
    await supabase.from("visit_claims").upsert(
      { user_id: user.id, place_id: place.id },
      { onConflict: "user_id,place_id" },
    );
    await supabase.rpc("refresh_place_aggregates", { p_place_id: place.id });
    await recordProductEvent("verification_succeeded", {
      place_id: place.id,
      confidence: geofence.confidence,
    });
  } else {
    if (parsed.data.experiencePostId) {
      await supabase
        .from("experience_posts")
        .update({ verification_status: "verification_failed" })
        .eq("id", parsed.data.experiencePostId)
        .eq("author_id", user.id);
    }
    await recordProductEvent("verification_failed", {
      place_id: place.id,
      reason: geofence.reason,
    });
  }

  revalidatePath(`/place/${place.slug}`);
  return {
    ok: true as const,
    result: geofence.result,
    reason: geofence.reason,
    confidence: geofence.confidence,
    distanceMeters: geofence.distanceMeters,
    verificationId: verification.id,
  };
}

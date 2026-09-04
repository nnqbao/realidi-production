import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireResourceOwner, requireVerifiedProfile } from "./_lib/authz";
import { invariant } from "./_lib/errors";
import { evaluateGeofenceE6 } from "./_lib/geofence";
import { refreshPlaceAggregates } from "./_lib/placeAggregates";
import { pairKey } from "./_lib/uniqueness";

export const verifyVisit = mutation({
  args: {
    placeId: v.id("places"),
    experiencePostId: v.optional(v.id("experience_posts")),
    latitude: v.number(),
    longitude: v.number(),
    accuracyMeters: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    const place = await ctx.db.get(args.placeId);
    invariant(
      place !== null && place.latitude_e6 !== undefined && place.longitude_e6 !== undefined,
      "NOT_FOUND",
      "Place not found",
    );
    const config = await ctx.db
      .query("ranking_config")
      .withIndex("by_seed_key", (q) => q.eq("seed_key", "ranking:default"))
      .unique();
    const radius = config?.geofence_radius_meters ?? 120;
    const geofence = evaluateGeofenceE6({
      userLatitude: args.latitude,
      userLongitude: args.longitude,
      placeLatitudeE6: place.latitude_e6,
      placeLongitudeE6: place.longitude_e6,
      radiusMeters: radius,
      accuracyMeters: args.accuracyMeters,
    });

    if (args.experiencePostId) {
      const post = await ctx.db.get(args.experiencePostId);
      invariant(post !== null, "NOT_FOUND", "Post not found");
      requireResourceOwner({ authUserId: profile.auth_user_id, profile }, post.author_id);
    }

    const now = Date.now();
    const verificationId = await ctx.db.insert("visit_verifications", {
      user_id: profile._id,
      place_id: args.placeId,
      experience_post_id: args.experiencePostId,
      method: "onsite_geolocation",
      result: geofence.result,
      confidence: geofence.confidence,
      distance_meters: Number.isFinite(geofence.distanceMeters) ? geofence.distanceMeters : undefined,
      accuracy_meters: args.accuracyMeters,
      geofence_radius_meters: radius,
      verified_at: geofence.result === "verified" ? now : undefined,
      metadata: { accuracy_class: geofence.reason },
      created_at: now,
    });

    if (geofence.result === "verified") {
      if (args.experiencePostId) {
        await ctx.db.patch(args.experiencePostId, {
          verification_status: "verified",
          updated_at: now,
        });
      }
      const key = pairKey(profile._id, args.placeId);
      const claim = await ctx.db
        .query("visit_claims")
        .withIndex("by_pair", (q) => q.eq("pair_key", key))
        .unique();
      if (claim === null) {
        await ctx.db.insert("visit_claims", {
          user_id: profile._id,
          place_id: args.placeId,
          pair_key: key,
          claimed_at: now,
        });
      }
      await refreshPlaceAggregates(ctx, args.placeId);
      await ctx.db.insert("product_events", {
        event_name: "verification_succeeded",
        user_id: profile._id,
        properties: { place_id: args.placeId, confidence: geofence.confidence },
        created_at: now,
      });
    } else {
      if (args.experiencePostId) {
        await ctx.db.patch(args.experiencePostId, {
          verification_status: "verification_failed",
          updated_at: now,
        });
      }
      await ctx.db.insert("product_events", {
        event_name: "verification_failed",
        user_id: profile._id,
        properties: { place_id: args.placeId, reason: geofence.reason },
        created_at: now,
      });
    }

    return {
      ok: true as const,
      result: geofence.result,
      reason: geofence.reason,
      confidence: geofence.confidence,
      distanceMeters: geofence.distanceMeters,
      verificationId,
    };
  },
});

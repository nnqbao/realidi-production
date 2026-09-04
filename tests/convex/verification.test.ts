import { describe, expect, it } from "vitest";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { seedDatabase } from "@/convex/seed";
import { authHarness } from "./auth-harness";

async function insertPerson(t: ReturnType<typeof authHarness>, username: string) {
  return await t.run(async (ctx) => {
    const authUser = await ctx.db.insert("users", {
      email: `${username}@test.dev`,
      emailVerificationTime: 1,
    });
    const profile = await ctx.db.insert("profiles", {
      auth_user_id: authUser,
      username,
      display_name: username,
      role: "user",
      locale: "vi",
      timezone: "Asia/Ho_Chi_Minh",
      show_activity_status: true,
      created_at: Date.now(),
      updated_at: Date.now(),
    });
    return { authUser, profile };
  });
}

describe("visit verification", () => {
  it("persists distance metadata and never raw coordinates", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const person = await insertPerson(t, "verifier");
    const client = t.withIdentity({ subject: `${person.authUser}|s-v` });
    const place = await t.run(async (ctx) =>
      ctx.db.query("places").withIndex("by_slug", (q) => q.eq("slug", "the-workshop-sai-gon")).unique(),
    );
    if (!place) throw new Error("missing workshop");
    const created = await client.mutation(api.experiences.create, {
      placeId: place._id,
      caption: "Đang ở đây",
      postType: "check_in",
      moodRatings: [],
    });

    const ok = await client.mutation(api.verification.verifyVisit, {
      placeId: place._id,
      experiencePostId: created.id,
      latitude: 10.7736,
      longitude: 106.7057,
      accuracyMeters: 12,
    });
    expect(ok.ok).toBe(true);
    expect(ok.result).toBe("verified");
    expect(ok.reason).toBe("within_fence");

    const row = await t.run(async (ctx) => ctx.db.get(ok.verificationId));
    expect(row?.result).toBe("verified");
    expect(row?.metadata).toEqual({ accuracy_class: "within_fence" });
    const blob = JSON.stringify(row);
    expect(blob).not.toMatch(/10\.7736|106\.7057|"lat"|"lng"|"latitude"|"longitude"/);

    const events = await t.run(async (ctx) =>
      ctx.db.query("product_events").withIndex("by_name_created", (q) => q.eq("event_name", "verification_succeeded")).collect(),
    );
    expect(events.some((event) => JSON.stringify(event.properties).includes("10.7736"))).toBe(false);
    const post = await t.run(async (ctx) => ctx.db.get(created.id));
    expect(post?.verification_status).toBe("verified");
  });

  it("fails far-away coordinates without writing raw GPS", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const person = await insertPerson(t, "far");
    const client = t.withIdentity({ subject: `${person.authUser}|s-far` });
    const place = await t.run(async (ctx) =>
      ctx.db.query("places").withIndex("by_slug", (q) => q.eq("slug", "the-workshop-sai-gon")).unique(),
    );
    if (!place) throw new Error("missing workshop");
    const failed = await client.mutation(api.verification.verifyVisit, {
      placeId: place._id,
      latitude: 10.82,
      longitude: 106.63,
      accuracyMeters: 10,
    });
    expect(failed.result).toBe("failed");
    expect(failed.reason).toBe("outside_fence");
    const row = await t.run(async (ctx) => ctx.db.get(failed.verificationId));
    expect(JSON.stringify(row)).not.toMatch(/10\.82|106\.63/);
  });

  it("forbids verifying another author's post", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const author = await insertPerson(t, "owner_post");
    const stranger = await insertPerson(t, "stranger_v");
    const authorClient = t.withIdentity({ subject: `${author.authUser}|s-own` });
    const strangerClient = t.withIdentity({ subject: `${stranger.authUser}|s-str` });
    const placeId = (await t.query(api.places.lite, {}))[0]!.id as Id<"places">;
    const created = await authorClient.mutation(api.experiences.create, {
      placeId,
      caption: "của tôi",
      moodRatings: [],
    });
    await expect(
      strangerClient.mutation(api.verification.verifyVisit, {
        placeId,
        experiencePostId: created.id,
        latitude: 10.7736,
        longitude: 106.7057,
      }),
    ).rejects.toThrow();
  });
});

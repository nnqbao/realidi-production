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

async function workshopAndMood(t: ReturnType<typeof authHarness>) {
  const places = await t.query(api.places.lite, {});
  const moods = await t.query(api.catalog.desiredMoods, {});
  const place = places.find((row) => row.name.includes("Workshop"));
  const mood = moods.find((row) => row.slug === "peaceful");
  if (!place || !mood) throw new Error("seed missing workshop or peaceful");
  return {
    placeId: place.id as Id<"places">,
    moodId: mood.id as Id<"moods">,
  };
}

describe("experiences", () => {
  it("publishes one post with ratings and refreshes place aggregates", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const author = await insertPerson(t, "writer");
    const client = t.withIdentity({ subject: `${author.authUser}|s-exp` });
    const { placeId, moodId } = await workshopAndMood(t);

    const created = await client.mutation(api.experiences.create, {
      placeId,
      caption: "Yên hơn mình nghĩ.",
      postType: "experience",
      visitContext: "solo",
      moodRatings: [{ moodId, rating: 5 }],
      crowdLevel: "quiet",
      worthIt: 4,
      spendPerPerson: 90000,
      visitDayType: "weekday",
      visitTimePeriod: "morning",
    });

    const post = await t.run(async (ctx) => ctx.db.get(created.id));
    expect(post?.status).toBe("published");
    expect(post?.like_count).toBe(0);
    const ratings = await t.run(async (ctx) =>
      ctx.db.query("experience_mood_ratings").withIndex("by_post", (q) => q.eq("experience_post_id", created.id)).collect(),
    );
    expect(ratings).toHaveLength(1);
    const moodStats = await t.run(async (ctx) =>
      ctx.db.query("place_mood_stats").withIndex("by_place", (q) => q.eq("place_id", placeId)).collect(),
    );
    expect(moodStats.some((row) => row.mood_id === moodId && row.sample_count === 1)).toBe(true);
    const exp = await t.run(async (ctx) =>
      ctx.db.query("place_experience_stats").withIndex("by_place", (q) => q.eq("place_id", placeId)).unique(),
    );
    expect(exp?.sample_count).toBe(1);
    const events = await t.run(async (ctx) =>
      ctx.db.query("product_events").withIndex("by_name_created", (q) => q.eq("event_name", "experience_published")).collect(),
    );
    expect(events.some((row) => row.properties.post_id === created.id)).toBe(true);
  });

  it("keeps drafts out of aggregates", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const author = await insertPerson(t, "drafter");
    const client = t.withIdentity({ subject: `${author.authUser}|s-draft` });
    const { placeId, moodId } = await workshopAndMood(t);
    await client.mutation(api.experiences.saveDraft, {
      placeId,
      caption: "Chưa xong",
      moodRatings: [{ moodId, rating: 3 }],
    });
    const exp = await t.run(async (ctx) =>
      ctx.db.query("place_experience_stats").withIndex("by_place", (q) => q.eq("place_id", placeId)).unique(),
    );
    expect(exp).toBeNull();
  });

  it("rejects guests and unverified accounts", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    await expect(t.mutation(api.experiences.create, { moodRatings: [] })).rejects.toThrow();
    const unverified = await t.run(async (ctx) => {
      const authUser = await ctx.db.insert("users", { email: "open@test.dev" });
      const profile = await ctx.db.insert("profiles", {
        auth_user_id: authUser,
        username: "open",
        display_name: "open",
        role: "user",
        locale: "vi",
        timezone: "Asia/Ho_Chi_Minh",
        show_activity_status: true,
        created_at: Date.now(),
        updated_at: Date.now(),
      });
      return { authUser, profile };
    });
    const client = t.withIdentity({ subject: `${unverified.authUser}|s-open` });
    await expect(client.mutation(api.experiences.create, { moodRatings: [] })).rejects.toThrow();
  });
});

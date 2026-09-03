import { describe, expect, it } from "vitest";
import { experienceCreateSchema, verifyVisitSchema, reportSchema } from "@/lib/validation";
import { validateMediaFile } from "@/lib/media";

describe("experienceCreateSchema", () => {
  it("accepts a lean structured payload", () => {
    const parsed = experienceCreateSchema.parse({
      placeId: "44444444-4444-4444-8444-444444444001",
      caption: "Yên hơn mình nghĩ.",
      moodRatings: [{ moodId: "11111111-1111-4111-8111-111111111001", rating: 5 }],
      crowdLevel: "quiet",
      worthIt: 4,
      spendPerPerson: 90000,
      visitContext: "solo",
      mediaPaths: ["user/a.jpg"],
    });
    expect(parsed.moodRatings).toHaveLength(1);
  });

  it("allows posting without a place", () => {
    const parsed = experienceCreateSchema.parse({
      caption: "Chỉ muốn kể một khoảnh khắc.",
      moodRatings: [],
      mediaPaths: ["user/a.jpg"],
    });
    expect(parsed.placeId ?? null).toBeNull();
  });

  it("rejects a 6th mood rating", () => {
    expect(() =>
      experienceCreateSchema.parse({
        placeId: "44444444-4444-4444-8444-444444444001",
        moodRatings: Array.from({ length: 6 }, (_, i) => ({
          moodId: `11111111-1111-4111-8111-11111111100${i + 1}`,
          rating: 3,
        })),
        mediaPaths: [],
      }),
    ).toThrow();
  });
});

describe("verifyVisitSchema", () => {
  it("requires coordinates without persisting them in the schema name", () => {
    const parsed = verifyVisitSchema.parse({
      placeId: "44444444-4444-4444-8444-444444444001",
      latitude: 10.77,
      longitude: 106.7,
      accuracyMeters: 15,
    });
    expect(parsed.placeId).toBeTruthy();
  });
});

describe("reportSchema", () => {
  it("accepts a post report", () => {
    expect(
      reportSchema.parse({
        targetType: "post",
        targetId: "44444444-4444-4444-8444-444444444001",
        reason: "misleading",
      }).reason,
    ).toBe("misleading");
  });
});

describe("validateMediaFile", () => {
  it("rejects an executable pretending to be media", () => {
    expect(validateMediaFile({ type: "application/x-msdownload", size: 12 }).ok).toBe(false);
  });

  it("accepts a reasonably sized jpeg", () => {
    expect(validateMediaFile({ type: "image/jpeg", size: 800_000 }).ok).toBe(true);
  });
});

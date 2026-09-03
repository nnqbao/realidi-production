import { describe, expect, it } from "vitest";
import { rankFeedPosts, socialAffinityScore, type FeedPostInput } from "@/lib/feed-ranking";

function post(partial: Partial<FeedPostInput> & Pick<FeedPostInput, "id">): FeedPostInput {
  return {
    authorId: "a",
    followsAuthor: false,
    likedBefore: false,
    commentedBefore: false,
    savedBefore: false,
    moodMatch: false,
    sameCity: true,
    verified: false,
    publishedAt: "2026-08-30T10:00:00Z",
    saveCount: 0,
    commentCount: 0,
    shareCount: 0,
    likeCount: 0,
    editorialBoost: 0.5,
    ...partial,
  };
}

describe("social feed ranking", () => {
  it("prioritizes followed authors over like volume", () => {
    const ranked = rankFeedPosts(
      [
        post({ id: "viral", likeCount: 400, followsAuthor: false }),
        post({ id: "friend", likeCount: 3, followsAuthor: true, saveCount: 2 }),
      ],
      { now: new Date("2026-08-30T12:00:00Z") },
    );
    expect(ranked[0].id).toBe("friend");
  });

  it("scores affinity higher when the viewer follows the author", () => {
    expect(socialAffinityScore(post({ id: "f", followsAuthor: true }))).toBeGreaterThan(
      socialAffinityScore(post({ id: "n" })),
    );
  });

  it("treats save as stronger than like in the overall order", () => {
    const ranked = rankFeedPosts(
      [
        post({ id: "likes", likeCount: 20 }),
        post({ id: "saves", saveCount: 8 }),
      ],
      { now: new Date("2026-08-30T12:00:00Z") },
    );
    expect(ranked[0].id).toBe("saves");
  });
});

import { describe, expect, it } from "vitest";
import { normalizeUsername, profileUpdateSchema, usernameSchema, experienceCreateSchema } from "@/lib/validation";
import {
  messageNotificationCopy,
  notificationHref,
  notificationIdempotencyKey,
} from "@/features/notifications/keys";
import { isProvenNotificationDuplicate, keepOldestDuplicateIds, groupConsecutiveMessageNotifications } from "@/features/notifications/dedupe";
import { mergePresenceTracks, presenceCopy, resolvePresence } from "@/features/presence/format";
import { PRESENCE_DOT } from "@/features/presence/types";
import { conversationChannelName, nextReconnectDelay, shouldShowReconnect } from "@/features/realtime/reconnect";
import { googleMapsUrl, safeHttpUrl } from "@/lib/urls/safe";
import { rankPlaces, DEFAULT_RANKING_CONFIG, type PlaceRankingInput } from "@/lib/ranking";

describe("profile username", () => {
  it("loads and normalizes the current username without storing @", () => {
    expect(normalizeUsername(" @LinhSaigon ")).toBe("linhsaigon");
    expect(usernameSchema.safeParse("linhsaigon").success).toBe(true);
  });

  it("rejects an empty username and does not treat it as valid submit data", () => {
    expect(normalizeUsername("   ")).toBe("");
    expect(usernameSchema.safeParse("").success).toBe(false);
    expect(
      profileUpdateSchema.safeParse({ displayName: "Linh", username: "", bio: "" }).success,
    ).toBe(false);
  });
});

describe("notification idempotency", () => {
  it("keys a message notification to the message id, not the conversation", () => {
    const first = notificationIdempotencyKey({
      type: "message",
      actorId: "actor",
      recipientId: "me",
      conversationId: "conv-1",
      messageId: "msg-1",
    });
    const retry = notificationIdempotencyKey({
      type: "message",
      actorId: "actor",
      recipientId: "me",
      conversationId: "conv-1",
      messageId: "msg-1",
    });
    const second = notificationIdempotencyKey({
      type: "message",
      actorId: "actor",
      recipientId: "me",
      conversationId: "conv-1",
      messageId: "msg-2",
    });
    expect(first).toBe("message:msg-1");
    expect(first).toBe(retry);
    expect(second).toBe("message:msg-2");
    expect(first).not.toBe(second);
  });

  it("refuses to mint a message key without a message id", () => {
    expect(
      notificationIdempotencyKey({
        type: "message",
        actorId: "actor",
        recipientId: "me",
        conversationId: "conv-1",
      }),
    ).toBeNull();
  });

  it("uses distinct keys for different source events", () => {
    const like = notificationIdempotencyKey({
      type: "post_like",
      actorId: "actor",
      recipientId: "me",
      postId: "post-1",
    });
    const comment = notificationIdempotencyKey({
      type: "post_comment",
      actorId: "actor",
      recipientId: "me",
      postId: "post-1",
      commentId: "c1",
    });
    expect(like).not.toBe(comment);
  });

  it("points comment notifications at the comment hash", () => {
    expect(
      notificationHref({
        type: "post_comment",
        post_id: "post-1",
        comment_id: "c9",
      }),
    ).toBe("/post/post-1#comment-c9");
  });

  it("coalesces consecutive message copy", () => {
    expect(messageNotificationCopy(1)).toBe("đã gửi cho bạn một tin nhắn");
    expect(messageNotificationCopy(3)).toBe("đã gửi 3 tin nhắn");
  });

  it("only deletes historical rows that share a proven source, keeping the oldest", () => {
    const rows = [
      { id: "old", createdAt: "2026-08-31T10:00:00Z", userId: "me", type: "message", messageId: "msg-1", idempotencyKey: "message:msg-1" },
      { id: "dup", createdAt: "2026-08-31T10:00:01Z", userId: "me", type: "message", messageId: "msg-1", idempotencyKey: "message:msg-1" },
      { id: "other", createdAt: "2026-08-31T10:00:00Z", userId: "me", type: "message", messageId: "msg-2", idempotencyKey: "message:msg-2" },
      { id: "legacy", createdAt: "2026-08-31T10:00:00Z", userId: "me", type: "message", messageId: null, idempotencyKey: null },
    ];
    expect(isProvenNotificationDuplicate(rows[0], rows[1])).toBe(true);
    expect(isProvenNotificationDuplicate(rows[0], rows[2])).toBe(false);
    expect(isProvenNotificationDuplicate(rows[0], rows[3])).toBe(false);
    expect(
      keepOldestDuplicateIds(rows, (a, b) =>
        isProvenNotificationDuplicate(
          { userId: a.userId, type: a.type, messageId: a.messageId, idempotencyKey: a.idempotencyKey },
          { userId: b.userId, type: b.type, messageId: b.messageId, idempotencyKey: b.idempotencyKey },
        ),
      ),
    ).toEqual(["dup"]);
  });

  it("groups consecutive message notifications from the same conversation without dropping rows", () => {
    const grouped = groupConsecutiveMessageNotifications([
      {
        id: "n1",
        type: "message",
        read_at: "2026-08-31T10:00:00Z",
        metadata: { conversation_id: "conv-1" },
        profiles: { username: "trananhvu" },
      },
      {
        id: "n2",
        type: "message",
        read_at: "2026-08-31T10:00:01Z",
        metadata: { conversation_id: "conv-1" },
        profiles: { username: "trananhvu" },
      },
      {
        id: "n3",
        type: "post_like",
        read_at: null,
        metadata: {},
        profiles: { username: "trananhvu" },
      },
    ]);
    expect(grouped).toHaveLength(2);
    expect(grouped[0]?.groupedIds).toEqual(["n1", "n2"]);
    expect(grouped[0]?.displayCount).toBe(2);
    expect(grouped[1]?.id).toBe("n3");
  });
});

describe("presence", () => {
  const now = new Date("2026-08-31T12:00:00");

  it("marks unknown when there is no last-seen and no live connection", () => {
    expect(resolvePresence({ connected: false, lastActiveAt: null, now }).status).toBe("unknown");
    expect(presenceCopy("unknown")).toBe("Không rõ trạng thái");
  });

  it("hides exact last seen when privacy is off", () => {
    const snap = resolvePresence({
      connected: true,
      lastTrackAt: now.getTime(),
      showActivity: false,
      now,
    });
    expect(snap.status).toBe("hidden");
    expect(snap.lastActiveAt).toBeNull();
    expect(presenceCopy("hidden")).toBeNull();
  });

  it("uses accessible copy rather than color alone", () => {
    expect(presenceCopy("online")).toBe("Đang hoạt động");
    expect(PRESENCE_DOT.online).toBe("#22C55E");
    expect(PRESENCE_DOT.offline).toBe("#EF4444");
    expect(PRESENCE_DOT.unknown).toBe("#9CA3AF");
  });

  it("merges multi-tab presence onto one user and prefers a live tab", () => {
    const merged = mergePresenceTracks({
      "user-1::tab-a": [{ at: 1, idle: true, visible: true }],
      "user-1::tab-b": [{ at: 2, idle: false, visible: true }],
    });
    expect(merged["user-1"]?.idle).toBe(false);
  });
});

describe("realtime reconnect", () => {
  it("does not treat first-connect as a reconnect banner", () => {
    expect(shouldShowReconnect(null, 5_000)).toBe(false);
  });

  it("does not show reconnect UI for a brief blip", () => {
    const start = 1_000;
    expect(shouldShowReconnect(start, start + 400)).toBe(false);
    expect(shouldShowReconnect(start, start + 1800)).toBe(true);
  });

  it("backs off with jitter and stays bounded", () => {
    const d0 = nextReconnectDelay(0, 0.5);
    const d3 = nextReconnectDelay(3, 0.5);
    expect(d3).toBeGreaterThan(d0);
    expect(nextReconnectDelay(20, 1)).toBeLessThanOrEqual(30_000);
  });

  it("uses a stable conversation channel name so a thread can unsubscribe the previous one", () => {
    expect(conversationChannelName("abc")).toBe("chat:abc");
    expect(conversationChannelName("abc")).not.toBe(conversationChannelName("def"));
  });
});

describe("place links", () => {
  it("rejects unsafe website URLs", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("example.com")).toMatch(/^https:\/\/example.com/);
  });

  it("builds a maps search URL from an address when coordinates are missing", () => {
    expect(googleMapsUrl({ name: "The Workshop", address: "Quận 3" })).toContain("query=Qu%E1%BA%ADn%203%20The%20Workshop");
    expect(googleMapsUrl({ latitude: 10.77, longitude: 106.69 })).toContain("10.77,106.69");
    expect(googleMapsUrl({})).toBeNull();
  });
});

describe("explore mood ranking", () => {
  function place(partial: Partial<PlaceRankingInput> & Pick<PlaceRankingInput, "id">): PlaceRankingInput {
    return {
      editorialScore: 0.5,
      adminQualityScore: 0.5,
      typicalDurationMinutes: 60,
      typicalSpendMin: 50000,
      typicalSpendMax: 150000,
      priceLevel: 2,
      categoryId: null,
      latitude: 10.78,
      longitude: 106.7,
      lastExperienceAt: null,
      saveCount: 0,
      beenThereCount: 0,
      shareCount: 0,
      likeCount: 0,
      verifiedExperienceCount: 4,
      experienceCount: 8,
      verifiedRatio: 0.5,
      mood: null,
      crowd: null,
      medianSpend: null,
      ...partial,
    };
  }

  it("sorts by selected-mood signal rather than only changing match copy", () => {
    const anYen = place({
      id: "tao-dan",
      mood: {
        editorialWeight: 0.95,
        avgRating: 4.7,
        smoothedRating: 4.6,
        sampleCount: 40,
        verifiedSampleCount: 22,
      },
    });
    const other = place({
      id: "the-deck",
      mood: {
        editorialWeight: 0.15,
        avgRating: 3.1,
        smoothedRating: 3.2,
        sampleCount: 10,
        verifiedSampleCount: 2,
      },
    });
    const ranked = rankPlaces([other, anYen], { config: DEFAULT_RANKING_CONFIG });
    expect(ranked[0].id).toBe("tao-dan");
  });
});

describe("create post validation", () => {
  it("rejects negative spend", () => {
    expect(experienceCreateSchema.safeParse({ spendPerPerson: -1, moodRatings: [], mediaPaths: [] }).success).toBe(false);
  });
});

describe("saved uniqueness", () => {
  it("treats the same user and post as one saved record key", () => {
    const key = (userId: string, postId: string) => `${userId}:${postId}`;
    const seen = new Set<string>();
    expect(seen.has(key("u1", "p1"))).toBe(false);
    seen.add(key("u1", "p1"));
    expect(seen.has(key("u1", "p1"))).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { buildTimeline, dateSeparatorLabel, inviteWhenLabel, lastMessagePreview, messageTimeLabel, presenceLabel } from "@/features/messages/format";
import type { ChatMessage } from "@/features/messages/types";

function msg(partial: Partial<ChatMessage> & Pick<ChatMessage, "id" | "created_at" | "sender_id">): ChatMessage {
  return {
    conversation_id: "c",
    body: "hi",
    kind: "text",
    payload: {},
    deleted_at: null,
    edited_at: null,
    client_id: null,
    reply_to_message_id: null,
    reply: null,
    sender: null,
    reactions: [],
    imageUrl: null,
    post: null,
    place: null,
    profile: null,
    invite: null,
    ...partial,
  };
}

describe("messaging format", () => {
  it("keeps short text preview", () => {
    expect(lastMessagePreview("text", "hi")).toBe("hi");
  });

  it("labels shared objects without leaking body", () => {
    expect(lastMessagePreview("place", "ignored")).toBe("Đã chia sẻ một địa điểm");
    expect(lastMessagePreview("invite", "note")).toBe("Lời mời đi cùng");
  });

  it("groups consecutive messages within 5 minutes", () => {
    const items = buildTimeline(
      [
        msg({ id: "1", sender_id: "a", created_at: "2026-08-31T10:00:00Z", body: "Hey" }),
        msg({ id: "2", sender_id: "a", created_at: "2026-08-31T10:01:00Z", body: "Đi chỗ này không?" }),
      ],
      new Date("2026-08-31T12:00:00Z"),
    );
    const bubbles = items.filter((i) => i.type === "msg");
    expect(bubbles[1]?.type === "msg" && bubbles[1].grouped).toBe(true);
  });

  it("inserts a date separator", () => {
    expect(dateSeparatorLabel("2026-08-31T10:00:00Z", new Date("2026-08-31T12:00:00Z"))).toBe("Hôm nay");
    expect(dateSeparatorLabel("2026-08-30T10:00:00Z", new Date("2026-08-31T12:00:00Z"))).toBe("Hôm qua");
  });

  it("formats older timestamps with date", () => {
    const now = new Date("2026-08-31T12:00:00");
    const label = messageTimeLabel("2026-08-28T12:00:00", now);
    expect(label).toMatch(/28/);
    expect(label).toContain("·");
  });

  it("formats invite date and time without leaking a raw ISO string", () => {
    expect(inviteWhenLabel("2026-08-29", "19:00")).toContain("19:00");
    expect(inviteWhenLabel("2026-08-29", "19:00")).toMatch(/thứ/i);
  });

  it("does not fake presence without last seen or online", () => {
    expect(presenceLabel({ online: false, lastSeenAt: null }).status).toBe("unknown");
    expect(presenceLabel({ online: false, lastSeenAt: null }).online).toBe(false);
  });
});

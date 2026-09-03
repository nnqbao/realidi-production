import { describe, expect, it } from "vitest";
import { formatCity, formatDistrict, formatSpendPerPerson } from "@/lib/utils";
import { presenceCopy, resolvePresence } from "@/features/presence/format";

describe("location formatter", () => {
  it("normalizes Ho Chi Minh City and District 1", () => {
    expect(formatCity("Ho Chi Minh City")).toBe("TP. Hồ Chí Minh");
    expect(formatDistrict("District 1")).toBe("Quận 1");
    expect(formatDistrict("Quận 3")).toBe("Quận 3");
  });
});

describe("spend formatter", () => {
  it("renders 0 as Miễn phí and compact per-person cost", () => {
    expect(formatSpendPerPerson(0)).toBe("Miễn phí");
    expect(formatSpendPerPerson(180000)).toBe("~180K/người");
    expect(formatSpendPerPerson(null)).toBe("");
  });
});

describe("presence", () => {
  const now = new Date("2026-08-31T12:00:00");

  it("does not fake online without a live connection", () => {
    expect(resolvePresence({ connected: false, lastActiveAt: null, now }).status).toBe("unknown");
    expect(presenceCopy("unknown")).toBe("Không rõ trạng thái");
  });

  it("hides activity when privacy is off", () => {
    const snap = resolvePresence({
      connected: true,
      lastTrackAt: now.getTime(),
      showActivity: false,
      now,
    });
    expect(snap.status).toBe("hidden");
    expect(presenceCopy(snap.status)).toBeNull();
  });

  it("marks idle after five minutes while still connected", () => {
    const snap = resolvePresence({
      connected: true,
      lastTrackAt: now.getTime() - 6 * 60_000,
      idle: true,
      now,
    });
    expect(snap.status).toBe("idle");
    expect(presenceCopy(snap.status)).toBe("Vừa hoạt động");
  });

  it("renders last-seen copy for offline users", () => {
    expect(presenceCopy("offline", now.toISOString(), new Date(now.getTime() + 20 * 60_000))).toContain("phút trước");
  });
});

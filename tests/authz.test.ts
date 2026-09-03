import { describe, expect, it } from "vitest";
import { assertAdmin, assertStaff, canModerate, isAdmin, isStaff } from "@/lib/auth/roles";

describe("roles", () => {
  it("treats moderator and admin as staff", () => {
    expect(isStaff("moderator")).toBe(true);
    expect(isStaff("admin")).toBe(true);
    expect(isStaff("owner")).toBe(true);
    expect(isStaff("editor")).toBe(true);
    expect(isStaff("user")).toBe(false);
    expect(isStaff("creator")).toBe(false);
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("moderator")).toBe(false);
    expect(canModerate("moderator")).toBe(true);
  });

  it("assertStaff throws for regular users", () => {
    expect(() => assertStaff("user")).toThrow("FORBIDDEN_STAFF");
    expect(() => assertStaff("admin")).not.toThrow();
  });

  it("assertAdmin throws for moderators", () => {
    expect(() => assertAdmin("moderator")).toThrow("FORBIDDEN_ADMIN");
    expect(() => assertAdmin("admin")).not.toThrow();
  });
});

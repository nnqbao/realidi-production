import { describe, expect, it } from "vitest";
import { safeReturnPath } from "@/lib/auth/return-to";
import {
  canAssignRoles,
  canManagePlaces,
  canManageUsers,
  canModerate,
  isAdmin,
  isOwner,
  isStaff,
  assertAdmin,
  assertStaff,
} from "@/lib/auth/roles";
import { accountGate, normalizeEmail } from "@/lib/auth/account";
import { parseCsv, csvHeaderIndex } from "@/lib/csv";
import { signUpSchema, loginSchema } from "@/lib/validation";

describe("safeReturnPath", () => {
  it("allows internal paths", () => {
    expect(safeReturnPath("/admin")).toBe("/admin");
    expect(safeReturnPath("/home?tab=following")).toBe("/home?tab=following");
  });

  it("blocks open redirects", () => {
    expect(safeReturnPath("//evil.com")).toBe("/home");
    expect(safeReturnPath("https://evil.com")).toBe("/home");
    expect(safeReturnPath("/\\evil.com")).toBe("/home");
    expect(safeReturnPath("http://evil.com")).toBe("/home");
    expect(safeReturnPath("/login?next=https://evil.com")).toBe("/home");
  });

  it("rejects protocol-relative and oversized values", () => {
    expect(safeReturnPath("")).toBe("/home");
    expect(safeReturnPath(" /admin")).toBe("/admin");
    expect(safeReturnPath(`/${"a".repeat(600)}`)).toBe("/home");
  });
});

describe("RBAC", () => {
  it("maps owner and editor into staff", () => {
    expect(isStaff("owner")).toBe(true);
    expect(isStaff("editor")).toBe(true);
    expect(isAdmin("owner")).toBe(true);
    expect(isAdmin("editor")).toBe(false);
    expect(isOwner("owner")).toBe(true);
    expect(canModerate("moderator")).toBe(true);
    expect(canModerate("editor")).toBe(false);
    expect(canManagePlaces("editor")).toBe(true);
    expect(canManagePlaces("moderator")).toBe(false);
    expect(canManageUsers("admin")).toBe(true);
    expect(canManageUsers("moderator")).toBe(false);
    expect(() => assertStaff("user")).toThrow("FORBIDDEN_STAFF");
    expect(() => assertAdmin("moderator")).toThrow("FORBIDDEN_ADMIN");
  });

  it("restricts role assignment", () => {
    expect(canAssignRoles("owner", "admin")).toBe(true);
    expect(canAssignRoles("admin", "owner")).toBe(false);
    expect(canAssignRoles("admin", "admin")).toBe(false);
    expect(canAssignRoles("admin", "moderator")).toBe(true);
    expect(canAssignRoles("moderator", "user")).toBe(false);
    expect(canAssignRoles("editor", "moderator")).toBe(false);
  });
});

describe("accountGate", () => {
  const base = {
    deleted_at: null,
    banned_at: null,
    suspended_at: null,
    suspension_ends_at: null,
  };

  it("blocks banned, deleted, and active suspensions", () => {
    expect(accountGate({ ...base, banned_at: "2026-01-01" }, true)).toBe("banned");
    expect(accountGate({ ...base, deleted_at: "2026-01-01" }, true)).toBe("deleted");
    expect(accountGate({ ...base, suspended_at: "2026-01-01" }, true)).toBe("suspended");
  });

  it("treats expired suspension as ok", () => {
    expect(
      accountGate({ ...base, suspended_at: "2020-01-01", suspension_ends_at: "2020-01-02" }, true),
    ).toBe("ok");
  });

  it("marks unverified email", () => {
    expect(accountGate(base, false)).toBe("unverified");
  });
});

describe("auth validation", () => {
  it("accepts a valid signup payload", () => {
    const parsed = signUpSchema.safeParse({
      email: "a@example.com",
      password: "correcthorse",
      confirmPassword: "correcthorse",
      displayName: "Lan",
      username: "lan_sg",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid email and mismatched passwords", () => {
    expect(signUpSchema.safeParse({
      email: "not-an-email",
      password: "correcthorse",
      confirmPassword: "correcthorse",
      displayName: "Lan",
      username: "lan_sg",
    }).success).toBe(false);
    expect(signUpSchema.safeParse({
      email: "a@example.com",
      password: "correcthorse",
      confirmPassword: "otherhorse",
      displayName: "Lan",
      username: "lan_sg",
    }).success).toBe(false);
  });

  it("does not distinguish unknown emails at schema level", () => {
    const parsed = loginSchema.safeParse({ email: "nobody@example.com", password: "x" });
    expect(parsed.success).toBe(true);
  });

  it("normalizes email", () => {
    expect(normalizeEmail("  A@Example.COM ")).toBe("a@example.com");
  });
});

describe("csv import parser", () => {
  it("parses quoted commas", () => {
    const rows = parseCsv('name,address\n"Cafe, A","12 Nguyen Hue"\n');
    expect(rows[1]).toEqual(["Cafe, A", "12 Nguyen Hue"]);
    expect(csvHeaderIndex(rows[0] ?? {}).name).toBe(0);
  });
});

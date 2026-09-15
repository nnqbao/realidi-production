import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "@/convex/schema";
import {
  optionalIdentity, requireAdmin, requireModerator, requireOwner, requirePlaceManager,
} from "@/convex/_lib/authz";
import type { UserRole } from "@/convex/validators";

const testModules = {
  "../../convex/_generated/server.ts": async () => ({}),
};

async function principal(role: UserRole, state?: "banned" | "suspended" | "deleted" | "unverified") {
  const t = convexTest(schema, testModules);
  const ids = await t.run(async (ctx) => {
    const authUserId = await ctx.db.insert("users", {
      email: `${role}@example.test`,
      ...(state === "unverified" ? {} : { emailVerificationTime: 1 }),
    });
    const profileId = await ctx.db.insert("profiles", {
      auth_user_id: authUserId, username: `${role}_test`, display_name: role,
      role, locale: "vi", timezone: "Asia/Ho_Chi_Minh", show_activity_status: true,
      ...(state === "banned" ? { banned_at: 1 } : {}),
      ...(state === "suspended" ? { suspended_at: 1, suspension_ends_at: 10_000 } : {}),
      ...(state === "deleted" ? { deleted_at: 1 } : {}),
      created_at: 1, updated_at: 1,
    });
    return { authUserId, profileId };
  });
  return { client: t.withIdentity({ subject: `${ids.authUserId}|test-session` }), ...ids };
}

describe("authorization kernel", () => {
  it("returns null for a guest and derives identity server-side", async () => {
    const t = convexTest(schema, testModules);
    expect(await t.run(optionalIdentity)).toBeNull();
    const editor = await principal("editor");
    const identity = await editor.client.run(optionalIdentity);
    expect(identity?.profile._id).toBe(editor.profileId);
    expect(identity?.profile.role).toBe("editor");
  });

  it("enforces each adjacent staff role boundary", async () => {
    for (const role of ["user", "creator", "editor"] as const) {
      await expect((await principal(role)).client.run(requireModerator)).rejects.toThrow();
    }
    await expect((await principal("moderator")).client.run(requireModerator)).resolves.toBeTruthy();

    for (const role of ["user", "creator", "moderator"] as const) {
      await expect((await principal(role)).client.run(requirePlaceManager)).rejects.toThrow();
    }
    await expect((await principal("editor")).client.run(requirePlaceManager)).resolves.toBeTruthy();

    for (const role of ["user", "creator", "moderator", "editor"] as const) {
      await expect((await principal(role)).client.run(requireAdmin)).rejects.toThrow();
    }
    await expect((await principal("admin")).client.run(requireAdmin)).resolves.toBeTruthy();

    for (const role of ["user", "creator", "moderator", "editor", "admin"] as const) {
      await expect((await principal(role)).client.run(requireOwner)).rejects.toThrow();
    }
    await expect((await principal("owner")).client.run(requireOwner)).resolves.toBeTruthy();
  });

  it("rejects inactive and unverified profiles before role checks", async () => {
    for (const state of ["banned", "suspended", "deleted", "unverified"] as const) {
      const owner = await principal("owner", state);
      await expect(owner.client.run((ctx) => requireOwner(ctx, 100))).rejects.toThrow();
    }
  });

  it("rejects a verified profile that still must change its password", async () => {
    const owner = await principal("owner");
    await owner.client.run(async (ctx) => {
      await ctx.db.patch(owner.profileId, { must_change_password: true });
    });
    await expect(owner.client.run((ctx) => requireOwner(ctx, 100))).rejects.toThrow();
  });
});

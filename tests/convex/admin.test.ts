import { describe, expect, it } from "vitest";
import { api, internal } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { seedDatabase } from "@/convex/seed";
import type { UserRole } from "@/convex/validators";
import { authHarness } from "./auth-harness";

async function insertPerson(
  t: ReturnType<typeof authHarness>,
  username: string,
  role: UserRole = "user",
) {
  return await t.run(async (ctx) => {
    const authUser = await ctx.db.insert("users", {
      email: `${username}@test.dev`,
      emailVerificationTime: 1,
    });
    const profile = await ctx.db.insert("profiles", {
      auth_user_id: authUser,
      username,
      display_name: username,
      role,
      locale: "vi",
      timezone: "Asia/Ho_Chi_Minh",
      show_activity_status: true,
      created_at: Date.now(),
      updated_at: Date.now(),
    });
    return { authUser, profile };
  });
}

function clientOf(
  t: ReturnType<typeof authHarness>,
  person: { authUser: Id<"users"> },
  session = "s-admin",
) {
  return t.withIdentity({ subject: `${person.authUser}|${session}` });
}

async function failureCode(operation: Promise<unknown>): Promise<string> {
  try {
    await operation;
    return "<no error>";
  } catch (error) {
    const data = (error as { data?: { code?: string } }).data;
    return data?.code ?? (error as Error).message;
  }
}

describe("admin capabilities", () => {
  it("keeps adjacent roles off ranking, flags, role change, and user status", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const user = await insertPerson(t, "p7_user");
    const creator = await insertPerson(t, "p7_creator", "creator");
    const editor = await insertPerson(t, "p7_editor", "editor");
    const moderator = await insertPerson(t, "p7_mod", "moderator");
    const admin = await insertPerson(t, "p7_admin", "admin");
    const target = await insertPerson(t, "p7_target");

    const ranking = {
      moodMatchWeight: 0.45,
      trustWeight: 0.2,
      freshnessWeight: 0.15,
      proximityWeight: 0.1,
      qualityEngagementWeight: 0.1,
      bayesianPriorMean: 3.2,
      bayesianPriorStrength: 8,
      geofenceRadiusMeters: 150,
    };

    for (const person of [user, creator, editor, moderator]) {
      const asRole = clientOf(t, person, `s-${person.profile}`);
      expect(await failureCode(asRole.mutation(api.admin.updateRanking, ranking))).toBe("FORBIDDEN");
      expect(await failureCode(asRole.mutation(api.admin.toggleFlag, { key: "ENABLE_MOOD_MAP", enabled: true }))).toBe(
        "FORBIDDEN",
      );
      expect(await failureCode(asRole.mutation(internal.admin.applyRole, {
        userId: target.profile,
        role: "moderator",
        reason: "nope",
      }))).toBe("FORBIDDEN");
      expect(await failureCode(asRole.query(api.admin.listAudit, {}))).toBe("FORBIDDEN");
    }

    const asAdmin = clientOf(t, admin);
    expect(await asAdmin.mutation(internal.admin.applyRole, {
      userId: target.profile,
      role: "owner",
      reason: "promote owner",
    })).toEqual({ error: "FORBIDDEN_ROLE" });
    expect(await asAdmin.mutation(internal.admin.applyRole, {
      userId: target.profile,
      role: "admin",
      reason: "promote admin",
    })).toEqual({ error: "FORBIDDEN_ROLE" });

    expect(await asAdmin.mutation(internal.admin.applyRole, {
      userId: target.profile,
      role: "moderator",
      reason: "promote moderator",
    })).toMatchObject({ ok: true, revoke: true });

    expect(await asAdmin.mutation(api.admin.updateRanking, ranking)).toEqual({ ok: true });
    expect(await asAdmin.mutation(api.admin.toggleFlag, { key: "ENABLE_MOOD_MAP", enabled: true })).toEqual({
      ok: true,
    });
    const flags = await asAdmin.query(api.admin.listFlags, {});
    expect(flags.find((row) => row.key === "ENABLE_MOOD_MAP")?.enabled).toBe(true);
  });

  it("protects the last owner from demotion and ban", async () => {
    const t = authHarness();
    const owner = await insertPerson(t, "p7_only_owner", "owner");
    const asOwner = clientOf(t, owner);
    expect(await asOwner.mutation(internal.admin.applyRole, {
      userId: owner.profile,
      role: "admin",
      reason: "step down",
    })).toEqual({ error: "LAST_OWNER" });
    expect(await asOwner.mutation(internal.admin.applyUserStatus, {
      userId: owner.profile,
      action: "ban",
      reason: "ban last owner",
    })).toEqual({ error: "LAST_OWNER" });

    const other = await insertPerson(t, "p7_second_owner", "owner");
    expect(await asOwner.mutation(internal.admin.applyRole, {
      userId: other.profile,
      role: "admin",
      reason: "demote spare owner",
    })).toMatchObject({ ok: true });
  });

  it("bans and suspends so the identity loses capability immediately", async () => {
    const t = authHarness();
    const admin = await insertPerson(t, "p7_ban_admin", "admin");
    const target = await insertPerson(t, "p7_ban_target", "moderator");
    const asAdmin = clientOf(t, admin);
    const asTarget = clientOf(t, target, "s-banned");

    expect(await asAdmin.mutation(internal.admin.applyUserStatus, {
      userId: target.profile,
      action: "suspend",
      reason: "cooldown",
      hours: 2,
    })).toMatchObject({ ok: true, revoke: true });

    const suspended = await t.run(async (ctx) => ctx.db.get(target.profile));
    expect(suspended?.suspended_at).toBeTypeOf("number");
    expect(await failureCode(asTarget.query(api.admin.dashboard, {}))).toBe("ACCOUNT_INACTIVE");

    expect(await asAdmin.mutation(internal.admin.applyUserStatus, {
      userId: target.profile,
      action: "restore",
      reason: "cleared",
    })).toMatchObject({ ok: true });
    expect(await asTarget.query(api.admin.dashboard, {})).toMatchObject({ users: expect.any(Number) });

    expect(await asAdmin.mutation(internal.admin.applyUserStatus, {
      userId: target.profile,
      action: "ban",
      reason: "abuse",
    })).toMatchObject({ ok: true, revoke: true });
    const banned = await t.run(async (ctx) => ctx.db.get(target.profile));
    expect(banned?.banned_at).toBeTypeOf("number");
    expect(banned?.ban_reason).toBe("abuse");
    expect(await failureCode(asTarget.query(api.admin.dashboard, {}))).toBe("ACCOUNT_INACTIVE");
  });

  it("rejects a status change without a reason", async () => {
    const t = authHarness();
    const admin = await insertPerson(t, "p7_reason_admin", "admin");
    const target = await insertPerson(t, "p7_reason_target");
    expect(await clientOf(t, admin).mutation(internal.admin.applyUserStatus, {
      userId: target.profile,
      action: "ban",
      reason: "   ",
    })).toEqual({ error: "REASON_REQUIRED" });
  });
});

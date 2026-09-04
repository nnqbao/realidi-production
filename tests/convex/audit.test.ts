import { describe, expect, it } from "vitest";
import { api, internal } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
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

function clientOf(t: ReturnType<typeof authHarness>, person: { authUser: Id<"users"> }) {
  return t.withIdentity({ subject: `${person.authUser}|s-audit` });
}

describe("append-only audit", () => {
  it("appends rows and never mutates earlier ones", async () => {
    const t = authHarness();
    const admin = await insertPerson(t, "p7_audit_admin", "admin");
    const target = await insertPerson(t, "p7_audit_target");
    const asAdmin = clientOf(t, admin);

    await asAdmin.mutation(internal.admin.applyRole, {
      userId: target.profile,
      role: "moderator",
      reason: "first",
    });
    const first = await t.run(async (ctx) => {
      const rows = await ctx.db.query("audit_logs").collect();
      expect(rows).toHaveLength(1);
      return rows[0]!;
    });
    expect(first.action).toBe("set_role");
    expect(first.reason).toBe("first");
    expect(first.before).toEqual({ role: "user" });
    expect(first.after).toEqual({ role: "moderator" });

    await asAdmin.mutation(internal.admin.applyUserStatus, {
      userId: target.profile,
      action: "suspend",
      reason: "second",
    });
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("audit_logs").collect();
      expect(rows).toHaveLength(2);
      const original = rows.find((row) => row._id === first._id);
      expect(original).toMatchObject({
        action: "set_role",
        reason: "first",
        before: { role: "user" },
        after: { role: "moderator" },
        created_at: first.created_at,
      });
    });

    const listed = await asAdmin.query(api.admin.listAudit, { query: "set_role" });
    expect(listed.map((row) => row.action)).toEqual(["set_role"]);
  });

  it("keeps audit reads admin-only and exposes no edit or delete API", async () => {
    const t = authHarness();
    const moderator = await insertPerson(t, "p7_audit_mod", "moderator");
    const editor = await insertPerson(t, "p7_audit_editor", "editor");
    await expect(clientOf(t, moderator).query(api.admin.listAudit, {})).rejects.toThrow();
    await expect(clientOf(t, editor).query(api.admin.listAudit, {})).rejects.toThrow();

    expect(api.admin).not.toHaveProperty("updateAudit");
    expect(api.admin).not.toHaveProperty("deleteAudit");
    expect(api.admin).not.toHaveProperty("editAudit");
  });
});

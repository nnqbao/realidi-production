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
  return t.withIdentity({ subject: `${person.authUser}|s-import` });
}

const valid = {
  latitude: 10.776,
  longitude: 106.7,
  status: "draft" as const,
};

describe("place CSV import", () => {
  it("rejects missing names, bad coordinates, and duplicate slugs or providers", async () => {
    const t = authHarness();
    const editor = await insertPerson(t, "p7_import_editor", "editor");
    await t.run(async (ctx) => {
      await ctx.db.insert("places", {
        slug: "existing-slug",
        name: "Existing",
        normalized_search: "existing",
        city: "TP. Hồ Chí Minh",
        country: "VN",
        currency: "VND",
        status: "active",
        source: "editorial",
        verified_by_admin: true,
        editorial_score: 0.5,
        admin_quality_score: 0.5,
        external_provider: "maps",
        external_provider_id: "old",
        external_provider_key: "maps:old",
        created_at: Date.now(),
        updated_at: Date.now(),
      });
    });
    const asEditor = clientOf(t, editor);
    const preview = await asEditor.mutation(internal.imports.preview, {
      rows: [
        { line: 2, name: "", slug: "empty", ...valid },
        { line: 3, name: "Bad lat", slug: "bad-lat", latitude: 120, longitude: 106.7, status: "draft" },
        { line: 4, name: "Dup A", slug: "same-cafe", ...valid },
        { line: 5, name: "Dup B", slug: "same-cafe", ...valid },
        { line: 6, name: "Existing", slug: "existing-slug", ...valid },
        {
          line: 7,
          name: "Provider hit",
          slug: "provider-hit",
          ...valid,
          externalProvider: "maps",
          externalProviderId: "old",
        },
        {
          line: 8,
          name: "New cafe",
          slug: "new-cafe",
          ...valid,
          externalProvider: "maps",
          externalProviderId: "fresh",
        },
      ],
    });
    expect(preview.results).toEqual([
      { line: 2, error: "Thiếu tên hoặc tọa độ không hợp lệ." },
      { line: 3, error: "Thiếu tên hoặc tọa độ không hợp lệ." },
      { line: 4, ok: true },
      { line: 5, skipped: "Slug đã tồn tại: same-cafe" },
      { line: 6, skipped: "Slug đã tồn tại: existing-slug" },
      { line: 7, skipped: "Provider đã tồn tại: maps:old" },
      { line: 8, ok: true },
    ]);
    expect(preview.accepted.map((row) => row.slug)).toEqual(["same-cafe", "new-cafe"]);
  });

  it("commits accepted rows in chunks and writes a summary audit", async () => {
    const t = authHarness();
    const editor = await insertPerson(t, "p7_import_commit", "editor");
    const asEditor = clientOf(t, editor);
    const rows = [
      { line: 2, name: "Cafe Mot", slug: "cafe-mot", ...valid },
      { line: 3, name: "", slug: "skip-me", ...valid },
      { line: 4, name: "Cafe Hai", slug: "cafe-hai", ...valid },
    ];
    const result = await asEditor.action(api.imports.commit, { rows });
    expect(result.inserted).toBe(2);
    expect(result.results.filter((row) => row.ok)).toHaveLength(2);

    const places = await t.run(async (ctx) => {
      const all = await ctx.db.query("places").collect();
      return all.map((row) => row.slug).sort();
    });
    expect(places).toEqual(["cafe-hai", "cafe-mot"]);

    const audit = await t.run(async (ctx) => ctx.db.query("audit_logs").collect());
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      action: "place_csv_import",
      after: { imported: 2, submitted: 3 },
    });
  });

  it("keeps moderators off the import path", async () => {
    const t = authHarness();
    const moderator = await insertPerson(t, "p7_import_mod", "moderator");
    await expect(
      clientOf(t, moderator).mutation(internal.imports.preview, {
        rows: [{ line: 2, name: "Nope", slug: "nope", ...valid }],
      }),
    ).rejects.toThrow();
  });
});

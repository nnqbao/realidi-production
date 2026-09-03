import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { canManageUsers, canModerate, isOwner, type UserRole } from "@/lib/auth/roles";
import { UserAdminActions } from "@/features/admin/user-actions";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>;
}) {
  const session = await getSessionUser();
  if (!session || (!canManageUsers(session.profile.role) && !canModerate(session.profile.role))) {
    return <p className="text-sm text-[#6F7480]">Bạn không có quyền xem người dùng.</p>;
  }
  const { q, role } = await searchParams;
  const supabase = await createServerSupabase();
  let query = supabase.from("profiles").select("id, display_name, username, role, created_at, suspended_at, banned_at").order("created_at", { ascending: false }).limit(100);
  if (role) query = query.eq("role", role as UserRole);
  const { data } = await query;
  const rows = (data ?? []).filter((u) => {
    if (!q) return true;
    const hay = `${u.display_name} ${u.username}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });
  const manage = canManageUsers(session?.profile.role);

  return (
    <div>
      <h1 className="font-display text-3xl">Người dùng</h1>
      <form className="mt-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Tên hoặc username" className="min-h-11 rounded-xl border border-brand/14 px-3" />
        <select name="role" defaultValue={role ?? ""} className="min-h-11 rounded-xl border border-brand/14 px-3">
          <option value="">Mọi role</option>
          <option value="user">user</option>
          <option value="moderator">moderator</option>
          <option value="editor">editor</option>
          <option value="admin">admin</option>
          <option value="owner">owner</option>
        </select>
        <button type="submit" className="min-h-11 rounded-xl bg-brand px-4 text-sm text-white">
          Lọc
        </button>
      </form>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2">Tên</th>
              <th>Username</th>
              <th>Role</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-b border-border/60">
                <td className="py-2">{u.display_name}</td>
                <td>@{u.username}</td>
                <td>{u.role}</td>
                <td>{u.banned_at ? "Cấm" : u.suspended_at ? "Tạm khóa" : "Hoạt động"}</td>
                <td>
                  {manage ? (
                    <UserAdminActions
                      userId={u.id}
                      role={u.role as UserRole}
                      suspended={Boolean(u.suspended_at)}
                      banned={Boolean(u.banned_at)}
                      canChangeRole={Boolean(session && (isOwner(session.profile.role) || session.profile.role === "admin"))}
                    />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/roles";
import { redirect } from "next/navigation";

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session.profile.role)) redirect("/admin");
  const { q } = await searchParams;
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(120);
  const rows = (data ?? []).filter((row) => {
    if (!q) return true;
    return `${row.action} ${row.target_type} ${row.reason ?? ""}`.toLowerCase().includes(q.toLowerCase());
  });
  return (
    <div>
      <h1 className="font-display text-3xl">Nhật ký kiểm toán</h1>
      <p className="mt-1 text-sm text-[#6F7480]">Không thể sửa hoặc xóa từ giao diện.</p>
      <form className="mt-4">
        <input name="q" defaultValue={q} placeholder="Tìm action, đối tượng" className="min-h-11 w-full max-w-md rounded-xl border border-brand/14 px-3" />
      </form>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-[#6F7480]">Chưa có nhật ký.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="rounded-2xl border border-subtle px-4 py-3 text-sm">
              <p className="font-medium">{row.action}</p>
              <p className="text-[#6F7480]">
                {row.target_type} {row.target_id} · {new Date(row.created_at).toLocaleString("vi-VN")}
              </p>
              {row.reason ? <p className="mt-1">{row.reason}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

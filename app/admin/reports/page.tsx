import { api } from "@/convex/_generated/api";
import { getSessionUser } from "@/lib/auth/session";
import { canModerate } from "@/lib/auth/roles";
import { convexQueryAuthed } from "@/lib/convex/server";
import { ReportActions } from "@/features/admin/report-actions";

const STATUS_LABEL: Record<string, string> = {
  pending: "Đang mở",
  investigating: "Đang xem",
  resolved: "Đã xử lý",
  dismissed: "Đã bỏ qua",
};

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const session = await getSessionUser();
  if (!session || !canModerate(session.profile.role)) {
    return (
      <p className="text-sm text-[#6F7480]">Bạn không có quyền xử lý báo cáo.</p>
    );
  }
  const { status, q } = await searchParams;
  const [filtered, staff] = await Promise.all([
    convexQueryAuthed(api.moderation.listReports, {
      status:
        status === "pending" ||
        status === "investigating" ||
        status === "resolved" ||
        status === "dismissed"
          ? status
          : undefined,
      query: q,
    }),
    convexQueryAuthed(api.admin.staffOptions, {}),
  ]);

  return (
    <div>
      <h1 className="font-display text-3xl">Báo cáo</h1>
      <form className="mt-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Tìm lý do, loại" className="min-h-11 rounded-xl border border-brand/14 px-3" />
        <select name="status" defaultValue={status ?? ""} className="min-h-11 rounded-xl border border-brand/14 px-3">
          <option value="">Mọi trạng thái</option>
          <option value="pending">Đang mở</option>
          <option value="investigating">Đang xem</option>
          <option value="resolved">Đã xử lý</option>
          <option value="dismissed">Đã bỏ qua</option>
        </select>
        <button type="submit" className="min-h-11 rounded-xl bg-brand px-4 text-sm text-white">
          Lọc
        </button>
      </form>
      {filtered.length === 0 ? (
        <p className="mt-6 text-sm text-[#6F7480]">Không có báo cáo phù hợp.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {filtered.map((r) => (
            <li key={r.id} className="rounded-2xl border border-subtle bg-surface p-4 text-sm">
              <p className="font-medium">
                {r.target_type} · {r.reason} · {STATUS_LABEL[r.status] ?? r.status} · {r.priority}
              </p>
              <p className="text-muted-foreground">{r.details}</p>
              <p className="mt-1 text-xs text-[#6F7480]">
                {r.target_id} · {new Date(r.created_at ?? "").toLocaleString("vi-VN")}
              </p>
              <ReportActions reportId={r.id} targetType={r.target_type} moderators={staff} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

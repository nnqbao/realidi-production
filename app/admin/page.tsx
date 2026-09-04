import Link from "next/link";
import { adminDashboardStats } from "@/features/admin/console-actions";

export default async function AdminHomePage() {
  const stats = await adminDashboardStats();
  const cards = [
    ["Tổng người dùng", stats.users],
    ["Người dùng mới 7 ngày", stats.users7],
    ["Người dùng mới 30 ngày", stats.users30],
    ["Tổng địa điểm", stats.places],
    ["Địa điểm nháp", stats.placesDraft],
    ["Địa điểm đang hiện", stats.placesPublished],
    ["Địa điểm ẩn", stats.placesHidden],
    ["Bài viết", stats.posts],
    ["Báo cáo đang mở", stats.reportsOpen],
    ["Báo cáo ưu tiên cao", stats.reportsHigh],
    ["Tài khoản tạm khóa", stats.suspended],
  ] as const;

  return (
    <div>
      <h1 className="font-display text-3xl">Tổng quan</h1>
      <p className="mt-1 text-sm text-muted-foreground">Số liệu vận hành thực. Không dùng dữ liệu giả.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-3xl border border-subtle bg-surface p-5">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 font-display text-3xl">{value}</p>
          </div>
        ))}
      </div>
      <h2 className="mt-10 font-display text-2xl">Hoạt động gần đây</h2>
      {stats.recent.length === 0 ? (
        <p className="mt-3 text-sm text-[#6F7480]">Chưa có nhật ký quản trị.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {stats.recent.map((row) => (
            <li key={row.id} className="rounded-2xl border border-subtle px-4 py-3 text-sm">
              {row.action} · {row.target_type} · {row.created_at ? new Date(row.created_at).toLocaleString("vi-VN") : ""}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-sm">
        <Link href="/admin/reports" className="underline">
          Mở hàng đợi kiểm duyệt
        </Link>
      </p>
    </div>
  );
}

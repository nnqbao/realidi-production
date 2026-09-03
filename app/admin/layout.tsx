import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { isStaff } from "@/lib/auth/roles";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ErrorState } from "@/components/states";

export const dynamic = "force-dynamic";

const links = [
  { href: "/admin", label: "Tổng quan" },
  { href: "/admin/reports", label: "Báo cáo" },
  { href: "/admin/users", label: "Người dùng" },
  { href: "/admin/places", label: "Địa điểm" },
  { href: "/admin/posts", label: "Bài viết" },
  { href: "/admin/comments", label: "Bình luận" },
  { href: "/admin/collections", label: "Nổi bật" },
  { href: "/admin/audit", label: "Nhật ký" },
  { href: "/admin/categories", label: "Danh mục" },
  { href: "/admin/moods", label: "Mood" },
  { href: "/admin/verifications", label: "Xác minh" },
  { href: "/admin/settings", label: "Cờ tính năng" },
  { href: "/admin/ranking", label: "Xếp hạng nơi" },
  { href: "/admin/feed", label: "Bảng tin" },
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="p-8">
        <ErrorState title="Chưa kết nối dữ liệu" description="Cấu hình máy chủ chưa sẵn sàng. Xem README." />
      </div>
    );
  }
  const session = await getSessionUser().catch(() => null);
  if (!session) {
    redirect("/login?next=/admin");
  }
  if (!isStaff(session.profile.role)) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="font-display text-3xl">Không có quyền truy cập</h1>
        <p className="mt-3 text-sm text-[#6F7480]">Tài khoản này không dùng được khu vực quản trị Realidi.</p>
        <Link href="/home" className="mt-6 inline-block text-sm underline">
          Về trang chủ
        </Link>
      </main>
    );
  }
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col md:flex-row">
      <aside className="border-b border-border p-4 md:w-56 md:border-b-0 md:border-r">
        <Link href="/home" className="font-display text-xl text-brand">
          Realidi Admin
        </Link>
        <p className="mt-1 text-xs text-[#6F7480]">{session.profile.role}</p>
        <nav className="mt-4 grid grid-cols-2 gap-1 md:grid-cols-1">
          {links.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-xl px-3 py-2 text-sm text-brand/72 hover:bg-brand/4 hover:text-brand">
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main id="main" className="flex-1 p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}

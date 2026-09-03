import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { ActivityStatusToggle } from "@/features/presence/activity-toggle";
import { SecurityPanel } from "@/features/auth/security-panel";
import { isStaff } from "@/lib/auth/roles";

export default async function SettingsPage() {
  const session = await getSessionUser().catch(() => null);
  if (!session) redirect("/login?next=/settings");
  return (
    <div className="px-4 py-6">
      <h1 className="font-display text-3xl">Cài đặt</h1>
      <p className="mt-2 text-sm text-[#6F7480]">Quyền riêng tư, bảo mật và tài khoản.</p>
      <div className="mt-8 max-w-lg space-y-4">
        {session.gate === "unverified" ? (
          <p className="rounded-2xl border border-brand/16 bg-brand/6 px-4 py-3 text-sm">
            Email chưa được xác minh. Kiểm tra hộp thư hoặc gửi lại từ mục bảo mật bên dưới.
          </p>
        ) : null}
        {isStaff(session.profile.role) ? (
          <p className="rounded-2xl border border-brand/16 bg-brand/6 px-4 py-3 text-sm">
            Tài khoản quản trị nên bật xác minh 2 bước trong Supabase Dashboard (Authentication → MFA).
          </p>
        ) : null}
        <ActivityStatusToggle initial={session.profile.show_activity_status !== false} />
        <Link href="/profile/edit" className="block rounded-2xl border border-brand/10 px-4 py-4 text-sm font-medium">
          Sửa hồ sơ
        </Link>
        <SecurityPanel
          email={session.user.email ?? ""}
          emailVerified={Boolean(session.user.email_confirmed_at)}
          username={session.profile.username}
        />
      </div>
    </div>
  );
}

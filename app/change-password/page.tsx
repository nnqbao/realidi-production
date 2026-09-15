import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { isStaff } from "@/lib/auth/roles";
import { ForceChangePasswordForm } from "@/features/auth/force-change-password-form";

export default async function ChangePasswordPage() {
  const session = await getSessionUser().catch(() => null);
  if (!session) redirect("/login?next=/change-password");
  if (!session.mustChangePassword) {
    redirect(isStaff(session.profile.role) ? "/admin" : "/home");
  }
  return (
    <main className="min-h-dvh bg-background">
      <div className="bg-brand px-4 py-10 text-white">
        <p className="font-display text-2xl text-white">Realidi</p>
        <p className="mt-2 max-w-md text-sm text-white/70">
          Đổi mật khẩu lần đầu trước khi tiếp tục.
        </p>
      </div>
      <div className="px-4 py-12">
        <ForceChangePasswordForm
          nextPath={isStaff(session.profile.role) ? "/admin" : "/home"}
        />
      </div>
    </main>
  );
}

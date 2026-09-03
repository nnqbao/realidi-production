"use client";

import { useState, useTransition } from "react";
import { updatePasswordAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/features/auth/password-field";
import Link from "next/link";

export default function UpdatePasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <main className="min-h-dvh bg-background">
      <div className="bg-brand px-4 py-10 text-white">
        <p className="font-display text-2xl">Realidi</p>
      </div>
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="font-display text-3xl">Mật khẩu mới</h1>
        <p className="mt-2 text-sm text-[#6F7480]">Liên kết hết hạn hoặc đã dùng sẽ không đổi được mật khẩu.</p>
        <form
          className="mt-6 space-y-4"
          action={(formData) =>
            start(async () => {
              const result = await updatePasswordAction(formData);
              if (result && "error" in result) {
                setError(
                  result.error === "MISMATCH"
                    ? "Mật khẩu xác nhận chưa khớp."
                    : "Không cập nhật được. Liên kết có thể đã hết hạn hoặc đã được dùng.",
                );
              }
            })
          }
        >
          <PasswordField id="password" label="Mật khẩu mới" autoComplete="new-password" />
          <PasswordField id="confirmPassword" name="confirmPassword" label="Xác nhận mật khẩu" autoComplete="new-password" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="signOutOthers" className="size-4 rounded" defaultChecked />
            Đăng xuất các thiết bị khác
          </label>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Đang lưu…" : "Cập nhật mật khẩu"}
          </Button>
        </form>
        <p className="mt-6 text-sm">
          <Link href="/login" className="underline">
            Đăng nhập lại
          </Link>
        </p>
      </div>
    </main>
  );
}

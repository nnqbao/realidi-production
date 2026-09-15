"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changePasswordAction } from "@/features/auth/actions";
import { LogoutButton } from "@/features/auth/logout-button";
import { Button } from "@/components/ui/button";
import { PasswordField } from "./password-field";

export function ForceChangePasswordForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-3xl">Đổi mật khẩu bắt buộc</h1>
      <p className="mt-2 text-sm text-[#6F7480]">
        Đây là lần đăng nhập đầu tiên. Nhập mật khẩu hiện tại và chọn mật khẩu mới trước khi dùng Realidi.
      </p>
      <form
        className="mt-6 space-y-4"
        action={(formData) => {
          if (pending) return;
          start(async () => {
            const result = await changePasswordAction(formData);
            if (result && "error" in result) {
              setError(
                result.error === "CURRENT"
                  ? "Mật khẩu hiện tại chưa đúng."
                  : result.error === "MISMATCH"
                    ? "Mật khẩu xác nhận chưa khớp."
                    : "Không đổi được mật khẩu.",
              );
              return;
            }
            router.push(nextPath);
            router.refresh();
          });
        }}
      >
        <PasswordField
          id="currentPassword"
          name="currentPassword"
          label="Mật khẩu hiện tại"
          autoComplete="current-password"
        />
        <PasswordField
          id="newPassword"
          name="password"
          label="Mật khẩu mới"
          autoComplete="new-password"
        />
        <PasswordField
          id="confirmNew"
          name="confirmPassword"
          label="Xác nhận mật khẩu mới"
          autoComplete="new-password"
        />
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Đang lưu…" : "Lưu mật khẩu mới"}
        </Button>
      </form>
      <div className="mt-6">
        <LogoutButton />
      </div>
    </div>
  );
}

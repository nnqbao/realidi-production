"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { formText } from "@/features/auth/form-values";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/features/auth/password-field";
import Link from "next/link";

export function UpdatePasswordForm({ email }: { email: string }) {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <main className="min-h-dvh bg-background">
      <div className="bg-brand px-4 py-10 text-white">
        <p className="font-display text-2xl">Realidi</p>
      </div>
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="font-display text-3xl">Mật khẩu mới</h1>
        <p className="mt-2 text-sm text-[#6F7480]">Mã hết hạn hoặc đã dùng sẽ không đổi được mật khẩu.</p>
        <form
          className="mt-6 space-y-4"
          action={(formData) =>
            start(async () => {
              const password = String(formData.get("password") ?? "");
              const confirm = String(formData.get("confirmPassword") ?? "");
              if (confirm && confirm !== password) {
                setError("Mật khẩu xác nhận chưa khớp.");
                return;
              }
              try {
                await signIn("password", {
                  flow: "reset-verification",
                  email: formText(formData, "email"),
                  code: formText(formData, "code"),
                  newPassword: password,
                });
                router.push("/settings?password=updated");
                router.refresh();
              } catch {
                setError("Không cập nhật được. Mã có thể đã hết hạn hoặc đã được dùng.");
              }
            })
          }
        >
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              defaultValue={email}
              className="mt-1"
              autoComplete="email"
            />
          </div>
          <div>
            <Label htmlFor="code">Mã đặt lại</Label>
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={8}
              className="mt-1 tracking-[0.3em]"
            />
          </div>
          <PasswordField id="password" label="Mật khẩu mới" autoComplete="new-password" />
          <PasswordField id="confirmPassword" name="confirmPassword" label="Xác nhận mật khẩu" autoComplete="new-password" />
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

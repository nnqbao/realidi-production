"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { formText } from "@/features/auth/form-values";
import { loginErrorCode } from "@/lib/convex/result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "./password-field";

function loginErrorCopy(code: string | undefined): string {
  if (code === "LOCKED" || code === "RATE_LIMIT") {
    return "Bạn đã thử quá nhiều lần. Đợi vài phút rồi thử lại.";
  }
  if (code === "suspended") return "Tài khoản đang bị tạm khóa.";
  if (code === "banned" || code === "deleted") return "Tài khoản này không thể đăng nhập.";
  return "Email hoặc mật khẩu chưa chính xác.";
}

export function LoginForm({ nextPath }: { nextPath: string }) {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-3xl">Chào mừng trở lại</h1>
      <form
        className="mt-6 space-y-4"
        action={(formData) => {
          if (pending) return;
          start(async () => {
            try {
              await signIn("password", {
                flow: "signIn",
                email: formText(formData, "email"),
                password: formText(formData, "password"),
              });
              router.push(nextPath);
              router.refresh();
            } catch (cause) {
              setError(loginErrorCopy(loginErrorCode(cause)));
            }
          });
        }}
      >
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required className="mt-1" autoComplete="email" />
        </div>
        <PasswordField id="password" label="Mật khẩu" autoComplete="current-password" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="remember" className="size-4 rounded border-brand/20" defaultChecked />
          Ghi nhớ đăng nhập
        </label>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Đang đăng nhập…" : "Đăng nhập"}
        </Button>
      </form>
      <p className="mt-4 text-sm">
        <Link className="underline" href="/reset-password">
          Quên mật khẩu
        </Link>
      </p>
      <p className="mt-2 text-sm">
        Chưa có tài khoản?{" "}
        <Link className="underline" href="/signup">
          Tạo tài khoản
        </Link>
      </p>
      <p className="mt-6 text-xs text-[#6F7480]">
        Bằng việc đăng nhập, bạn đồng ý với{" "}
        <Link className="underline" href="/terms">Điều khoản sử dụng</Link>
        {" "}và{" "}
        <Link className="underline" href="/privacy">Chính sách quyền riêng tư</Link>.
      </p>
      <p className="mt-4 text-sm">
        <Link className="text-muted-foreground underline" href="/home">
          Tiếp tục xem với tư cách khách
        </Link>
      </p>
    </div>
  );
}

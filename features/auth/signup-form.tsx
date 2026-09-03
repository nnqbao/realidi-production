"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { checkUsernameAvailable, resendVerificationAction, signUpAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "./password-field";
import { normalizeUsername } from "@/lib/validation";

function strengthLabel(password: string): { label: string; width: string } {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;
  if (score <= 1) return { label: "Mật khẩu còn yếu — tối thiểu 8 ký tự", width: "25%" };
  if (score === 2) return { label: "Mật khẩu ổn", width: "50%" };
  if (score === 3) return { label: "Mật khẩu khá tốt", width: "75%" };
  return { label: "Mật khẩu mạnh", width: "100%" };
}

export function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [needsEmail, setNeedsEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [usernameNote, setUsernameNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const strength = useMemo(() => strengthLabel(password), [password]);

  if (needsEmail) {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-3xl">Kiểm tra email</h1>
        <p className="mt-3 text-sm text-[#6F7480]">
          Nếu địa chỉ hợp lệ, chúng tôi đã gửi liên kết xác nhận. Mở email rồi quay lại Realidi để hoàn tất.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-6"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await resendVerificationAction(needsEmail);
            })
          }
        >
          {pending ? "Đang gửi…" : "Gửi lại email xác minh"}
        </Button>
        <p className="mt-4 text-sm">
          <Link href="/login" className="underline">
            Đăng nhập
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-3xl">Bắt đầu với Realidi</h1>
      <form
        className="mt-6 space-y-4"
        action={(formData) => {
          if (pending) return;
          start(async () => {
            const result = await signUpAction(formData);
            if (result && "needsEmail" in result && result.needsEmail) {
              setNeedsEmail("email" in result ? result.email : "");
              return;
            }
            if (result && "error" in result) {
              if (result.error === "USERNAME_TAKEN") setError("Tên người dùng đã được dùng.");
              else if (result.error === "TERMS") setError("Cần đồng ý điều khoản để tạo tài khoản.");
              else if (result.error === "RATE_LIMIT") setError("Bạn đã thử quá nhiều lần. Đợi rồi thử lại.");
              else setError("Không tạo được tài khoản. Kiểm tra thông tin rồi thử lại.");
            }
          });
        }}
      >
        <div>
          <Label htmlFor="displayName">Họ tên</Label>
          <Input id="displayName" name="displayName" required className="mt-1" autoComplete="name" />
        </div>
        <div>
          <Label htmlFor="username">Tên người dùng</Label>
          <Input
            id="username"
            name="username"
            required
            className="mt-1"
            autoComplete="username"
            pattern="[a-z0-9_]{3,30}"
            onBlur={(e) => {
              const value = normalizeUsername(e.target.value);
              if (value.length < 3) return;
              start(async () => {
                const check = await checkUsernameAvailable(value);
                setUsernameNote(check.available ? "Có thể dùng." : "Tên này đã được dùng.");
              });
            }}
          />
          {usernameNote ? <p className="mt-1 text-xs text-[#6F7480]">{usernameNote}</p> : null}
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required className="mt-1" autoComplete="email" />
        </div>
        <PasswordField id="password" label="Mật khẩu" autoComplete="new-password" value={password} onChange={setPassword} />
        <div className="h-1.5 overflow-hidden rounded-full bg-brand/10" aria-hidden>
          <div className="h-full bg-brand transition-all" style={{ width: strength.width }} />
        </div>
        <p className="text-xs text-[#6F7480]">{strength.label}</p>
        <PasswordField id="confirmPassword" name="confirmPassword" label="Xác nhận mật khẩu" autoComplete="new-password" />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="terms" required className="mt-1" />
          <span>
            Tôi đồng ý với{" "}
            <Link href="/terms" className="underline">Điều khoản sử dụng</Link>
            {" "}và{" "}
            <Link href="/privacy" className="underline">Chính sách quyền riêng tư</Link>.
          </span>
        </label>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Đang tạo…" : "Tạo tài khoản"}
        </Button>
      </form>
      <p className="mt-4 text-sm">
        Đã có tài khoản?{" "}
        <Link className="underline" href="/login">
          Đăng nhập
        </Link>
      </p>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { resetPasswordAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default function ResetPasswordPage() {
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  return (
    <main className="min-h-dvh bg-background">
      <div className="bg-brand px-4 py-10 text-white">
        <p className="font-display text-2xl">Realidi</p>
      </div>
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="font-display text-3xl">Đặt lại mật khẩu</h1>
        {done ? (
          <p className="mt-4 text-sm text-[#6F7480]">
            Nếu email tồn tại trên Realidi, chúng tôi đã gửi hướng dẫn. Liên kết chỉ dùng được một lần và sẽ hết hạn.
          </p>
        ) : (
          <form
            className="mt-6 space-y-4"
            action={(formData) =>
              start(async () => {
                await resetPasswordAction(formData);
                setDone(true);
              })
            }
          >
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required className="mt-1" autoComplete="email" />
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Đang gửi…" : "Gửi email khôi phục"}
            </Button>
          </form>
        )}
        <p className="mt-6 text-sm">
          <Link href="/login" className="underline">
            Quay lại đăng nhập
          </Link>
        </p>
      </div>
    </main>
  );
}

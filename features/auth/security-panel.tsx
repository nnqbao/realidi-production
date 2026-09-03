"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  changePasswordAction,
  logoutOthersAction,
  logoutAllAction,
  resendVerificationAction,
} from "@/features/auth/actions";
import { exportMyDataAction, requestAccountDeletionAction } from "./security-actions";
import { Button } from "@/components/ui/button";
import { PasswordField } from "./password-field";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function SecurityPanel({
  email,
  emailVerified,
  username,
}: {
  email: string;
  emailVerified: boolean;
  username: string;
}) {
  const [pending, start] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-brand/10 bg-surface px-4 py-4">
        <h2 className="font-medium text-brand">Email</h2>
        <p className="mt-1 text-sm text-[#6F7480]">{email}</p>
        <p className="mt-1 text-sm">{emailVerified ? "Đã xác minh" : "Chưa xác minh"}</p>
        {!emailVerified ? (
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await resendVerificationAction(email);
                if (result && "error" in result && result.error === "RATE_LIMIT") {
                  toast.error("Bạn vừa gửi rồi. Đợi rồi thử lại.");
                  return;
                }
                toast.success("Nếu email hợp lệ, chúng tôi đã gửi lại liên kết xác minh.");
              })
            }
          >
            Gửi lại email xác minh
          </Button>
        ) : null}
      </section>

      <section className="rounded-2xl border border-brand/10 bg-surface px-4 py-4">
        <h2 className="font-medium text-brand">Đổi mật khẩu</h2>
        <form
          className="mt-3 space-y-3"
          action={(formData) =>
            start(async () => {
              const result = await changePasswordAction(formData);
              if (result && "error" in result) {
                toast.error(
                  result.error === "CURRENT"
                    ? "Mật khẩu hiện tại chưa đúng."
                    : result.error === "MISMATCH"
                      ? "Mật khẩu xác nhận chưa khớp."
                      : "Không đổi được mật khẩu.",
                );
                return;
              }
              toast.success("Đã đổi mật khẩu.");
            })
          }
        >
          <PasswordField id="currentPassword" name="currentPassword" label="Mật khẩu hiện tại" autoComplete="current-password" />
          <PasswordField id="newPassword" name="password" label="Mật khẩu mới" autoComplete="new-password" />
          <PasswordField id="confirmNew" name="confirmPassword" label="Xác nhận mật khẩu mới" autoComplete="new-password" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="signOutOthers" className="size-4 rounded" />
            Đăng xuất các thiết bị khác
          </label>
          <Button type="submit" disabled={pending}>
            Lưu mật khẩu
          </Button>
        </form>
      </section>

      <section className="rounded-2xl border border-brand/10 bg-surface px-4 py-4">
        <h2 className="font-medium text-brand">Phiên đăng nhập</h2>
        <p className="mt-1 text-sm text-[#6F7480]">Đăng xuất thiết bị khác hoặc tất cả thiết bị, kể cả thiết bị này.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await logoutOthersAction();
                toast.success("Đã đăng xuất các thiết bị khác.");
              })
            }
          >
            Đăng xuất thiết bị khác
          </Button>
          <Button type="button" variant="outline" disabled={pending} onClick={() => start(async () => logoutAllAction())}>
            Đăng xuất tất cả thiết bị
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-brand/10 bg-surface px-4 py-4">
        <h2 className="font-medium text-brand">Dữ liệu của bạn</h2>
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await exportMyDataAction();
              if (!result || "error" in result) {
                toast.error("Không tải được dữ liệu lúc này.");
                return;
              }
              const blob = new Blob([JSON.stringify(result.payload, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "realidi-data.json";
              a.click();
              URL.revokeObjectURL(url);
            })
          }
        >
          Tải dữ liệu cá nhân
        </Button>
      </section>

      <section className="rounded-2xl border border-destructive/20 bg-surface px-4 py-4">
        <h2 className="font-medium text-destructive">Xóa tài khoản</h2>
        <p className="mt-1 text-sm text-[#6F7480]">
          Tài khoản sẽ bị ẩn. Một số dữ liệu có thể được giữ vì lý do kiểm duyệt hoặc pháp lý.
        </p>
        {deleteOpen ? (
          <form
            className="mt-3 space-y-3"
            action={(formData) =>
              start(async () => {
                const result = await requestAccountDeletionAction(formData);
                if (result && "error" in result) {
                  toast.error(result.error === "CONFIRM" ? "Nhập đúng tên người dùng để xác nhận." : "Mật khẩu chưa đúng.");
                }
              })
            }
          >
            <div>
              <Label htmlFor="confirm">Nhập username `{username}` để xác nhận</Label>
              <Input id="confirm" name="confirm" className="mt-1" required />
            </div>
            <PasswordField id="deletePassword" name="password" label="Mật khẩu" autoComplete="current-password" />
            <Button type="submit" variant="destructive" disabled={pending}>
              Xóa tài khoản
            </Button>
          </form>
        ) : (
          <Button type="button" variant="outline" className="mt-3" onClick={() => setDeleteOpen(true)}>
            Yêu cầu xóa tài khoản
          </Button>
        )}
      </section>
    </div>
  );
}

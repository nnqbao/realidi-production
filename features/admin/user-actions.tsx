"use client";

import { useState, useTransition } from "react";
import { adminChangeRole, adminSetUserStatus } from "@/features/admin/console-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { UserRole } from "@/lib/auth/roles";

export function UserAdminActions({
  userId,
  role,
  suspended,
  banned,
  canChangeRole,
}: {
  userId: string;
  role: UserRole;
  suspended: boolean;
  banned: boolean;
  canChangeRole: boolean;
}) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<"role" | "suspend" | "ban" | null>(null);
  const [nextRole, setNextRole] = useState<UserRole>(role);
  const [reason, setReason] = useState("");

  function run(action: () => Promise<void>) {
    start(async () => {
      await action();
      setOpen(null);
      setReason("");
    });
  }

  return (
    <div className="flex flex-col gap-2 md:items-end">
      {canChangeRole ? (
        <select
          defaultValue={role}
          disabled={pending}
          className="min-h-9 rounded-xl border border-brand/14 px-2 text-sm"
          onChange={(e) => {
            setNextRole(e.target.value as UserRole);
            setOpen("role");
          }}
        >
          <option value="user">user</option>
          <option value="creator">creator</option>
          <option value="moderator">moderator</option>
          <option value="editor">editor</option>
          <option value="admin">admin</option>
          <option value="owner">owner</option>
        </select>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setOpen("suspend")}>
          {suspended ? "Bỏ khóa" : "Tạm khóa"}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setOpen("ban")}>
          {banned ? "Khôi phục" : "Cấm"}
        </Button>
      </div>
      <Dialog open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent fullScreenMobile={false} className="p-6">
          <DialogTitle className="font-display text-2xl">Xác nhận thao tác</DialogTitle>
          <p className="mt-2 text-sm text-[#6F7480]">Nhập lý do. Thao tác khóa hoặc cấm bắt buộc có lý do.</p>
          <textarea
            className="mt-3 min-h-24 w-full rounded-xl border border-brand/14 px-3 py-2 text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Lý do"
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(null)}>
              Hủy
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  if (open === "role") {
                    const result = await adminChangeRole(userId, nextRole, reason);
                    if (result && "error" in result) {
                      toast.error(result.error === "LAST_OWNER" ? "Không thể hạ Owner cuối cùng." : "Không đổi được quyền.");
                      return;
                    }
                    toast.success("Đã cập nhật quyền.");
                    return;
                  }
                  if (open === "suspend") {
                    const result = await adminSetUserStatus({
                      userId,
                      action: suspended ? "unsuspend" : "suspend",
                      reason,
                      hours: 168,
                    });
                    if (result && "error" in result) toast.error("Không cập nhật được.");
                    else toast.success(suspended ? "Đã mở khóa." : "Đã tạm khóa 7 ngày.");
                    return;
                  }
                  const result = await adminSetUserStatus({
                    userId,
                    action: banned ? "restore" : "ban",
                    reason,
                  });
                  if (result && "error" in result) {
                    toast.error(result.error === "LAST_OWNER" ? "Không cấm Owner cuối." : "Không thực hiện được.");
                  } else {
                    toast.success(banned ? "Đã khôi phục." : "Đã cấm tài khoản.");
                  }
                })
              }
            >
              Xác nhận
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

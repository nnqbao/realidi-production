"use client";

import { useState, useTransition } from "react";
import { submitReport } from "@/features/social/actions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ReportButton({
  targetType,
  targetId,
}: {
  targetType: "post" | "comment" | "user" | "place";
  targetId: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div>
      <button type="button" className="min-h-10 text-sm text-muted-foreground" onClick={() => setOpen((v) => !v)}>
        Báo cáo
      </button>
      {open ? (
        <form
          className="mt-2 space-y-2 rounded-2xl border border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            start(async () => {
              try {
                await submitReport({
                  targetType,
                  targetId,
                  reason: String(form.get("reason")),
                  details: String(form.get("details") || ""),
                });
                toast.success("Đã gửi báo cáo. Đội ngũ sẽ xem.");
                setOpen(false);
              } catch {
                toast.error("Không gửi được báo cáo.");
              }
            });
          }}
        >
          <label className="block text-xs">
            Lý do
            <select name="reason" className="mt-1 w-full rounded-xl border border-brand/14 bg-surface px-3 py-2">
              <option value="spam">Spam</option>
              <option value="harassment">Quấy rối</option>
              <option value="hate">Nội dung thù ghét</option>
              <option value="inappropriate">Không phù hợp</option>
              <option value="misleading">Thông tin sai lệch</option>
              <option value="impersonation">Giả mạo</option>
              <option value="privacy">Vi phạm quyền riêng tư</option>
              <option value="other">Lý do khác</option>
            </select>
          </label>
          <textarea name="details" className="w-full rounded-xl border border-input p-2 text-sm" rows={2} />
          <Button type="submit" size="sm" disabled={pending}>
            Gửi
          </Button>
        </form>
      ) : null}
    </div>
  );
}

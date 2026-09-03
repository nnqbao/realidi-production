"use client";

import { useState, useTransition } from "react";
import { adminAssignReport, adminModerateReport } from "@/features/admin/console-actions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ReportActions({
  reportId,
  targetType,
  moderators,
}: {
  reportId: string;
  targetType: string;
  moderators: { id: string; display_name: string }[];
}) {
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="mt-3 space-y-2">
      <label className="block text-xs">
        Gán cho
        <select
          className="mt-1 w-full rounded-xl border border-brand/14 bg-surface px-3 py-2"
          defaultValue=""
          onChange={(e) => {
            const id = e.target.value || null;
            start(async () => {
              await adminAssignReport(reportId, id);
              toast.success("Đã gán báo cáo.");
            });
          }}
        >
          <option value="">Chưa gán</option>
          {moderators.map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name}
            </option>
          ))}
        </select>
      </label>
      <textarea
        className="w-full rounded-xl border border-brand/14 bg-surface px-3 py-2 text-sm"
        placeholder="Lý do xử lý (bắt buộc với khóa/cấm)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await adminModerateReport({ reportId, decision: "dismissed", reason });
              toast.success("Đã bỏ qua báo cáo.");
            })
          }
        >
          Bỏ qua
        </Button>
        {(targetType === "post" || targetType === "comment") && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                if (!reason.trim()) {
                  toast.error("Nhập lý do trước khi ẩn nội dung.");
                  return;
                }
                await adminModerateReport({ reportId, decision: "resolved", reason, hideTarget: true });
                toast.success("Đã ẩn nội dung.");
              })
            }
          >
            Ẩn nội dung
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await adminModerateReport({ reportId, decision: "resolved", reason });
              toast.success("Đã xử lý báo cáo.");
            })
          }
        >
          Đánh dấu đã xử lý
        </Button>
      </div>
    </div>
  );
}

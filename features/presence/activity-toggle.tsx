"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setShowActivityStatus } from "@/features/presence/actions";

export function ActivityStatusToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <label className="flex items-start justify-between gap-4 rounded-2xl border border-brand/10 bg-surface px-4 py-4">
      <span>
        <span className="block font-medium text-brand">Hiển thị trạng thái hoạt động</span>
        <span className="mt-1 block text-sm text-[#6F7480]">
          Cho phép người khác biết khi bạn đang hoạt động hoặc vừa hoạt động trên Realidi.
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Hiển thị trạng thái hoạt động"
        disabled={pending}
        onClick={() => {
          const next = !on;
          setOn(next);
          start(async () => {
            const result = await setShowActivityStatus(next);
            if ("error" in result && result.error) {
              setOn(!next);
              toast.error("Không lưu được cài đặt. Thử lại.");
              return;
            }
            toast.success(next ? "Đã hiện trạng thái hoạt động" : "Đã ẩn trạng thái hoạt động");
          });
        }}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-brand" : "bg-brand/20"}`}
      >
        <span className={`absolute top-0.5 size-6 rounded-full bg-white transition-transform ${on ? "left-5" : "left-0.5"}`} />
      </button>
    </label>
  );
}

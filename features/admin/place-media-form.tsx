"use client";

import { useTransition } from "react";
import { adminUploadPlaceImage } from "@/features/admin/console-actions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function PlaceMediaForm({ placeId }: { placeId: string }) {
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-3 rounded-2xl border border-subtle p-4"
      action={(formData) =>
        start(async () => {
          const result = await adminUploadPlaceImage(placeId, formData);
          if (result && "error" in result) {
            toast.error(result.error === "SVG" ? "Không nhận file SVG." : "Không tải ảnh được.");
            return;
          }
          toast.success("Đã thêm ảnh.");
        })
      }
    >
      <p className="font-medium">Ảnh địa điểm</p>
      <p className="text-xs text-[#6F7480]">JPEG, PNG, WebP hoặc AVIF. Tối đa 8MB. Không nhận SVG. Nên dùng khoảng 1200×800.</p>
      <input type="file" name="file" accept="image/jpeg,image/png,image/webp,image/avif" required />
      <input name="alt" placeholder="Alt text" className="min-h-11 w-full rounded-xl border border-brand/14 px-3" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="cover" />
        Đặt làm ảnh đại diện
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Đang tải…" : "Tải ảnh"}
      </Button>
    </form>
  );
}

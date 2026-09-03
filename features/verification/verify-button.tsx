"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { verifyVisitAction } from "@/features/verification/actions";

export function VerifyVisitButton({ placeId, postId }: { placeId: string; postId?: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<"idle" | "success" | "failed">("idle");

  function request() {
    start(async () => {
      if (!navigator.geolocation) {
        toast.error("Trình duyệt không hỗ trợ vị trí. Bạn có thể thử lại sau.");
        setStatus("failed");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const result = await verifyVisitAction({
            placeId,
            experiencePostId: postId ?? null,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracyMeters: pos.coords.accuracy,
          });
          if (!result.ok) {
            setStatus("failed");
            toast.error("Không xác minh được lúc này.");
            return;
          }
          if (result.result === "verified") {
            setStatus("success");
            toast.success("Lần đến đã được xác minh.");
          } else {
            setStatus("failed");
          }
        },
        () => {
          setStatus("failed");
          toast.error("Không nhận được vị trí. Bạn có thể thử lại — Realidi không theo dõi liên tục.");
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
      );
    });
  }

  return (
    <div>
      <Button type="button" variant="secondary" onClick={() => setOpen((v) => !v)}>
        Xác minh lần đến
      </Button>
      {open ? (
        <div className="mt-3 rounded-2xl border border-subtle bg-surface p-4 text-sm">
          <p>
            Realidi chỉ cần vị trí <strong>lúc này</strong> để kiểm tra bạn có đang ở gần nơi này không. Chúng tôi không
            theo dõi liên tục và không công khai tọa độ của bạn.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" onClick={request} disabled={pending}>
              Cho phép vị trí lần này
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Để sau
            </Button>
          </div>
          {status === "failed" ? (
            <p className="mt-3 text-muted-foreground">
              Không xác minh được lần này. Có thể bạn đang ngoài bán kính, hoặc GPS chưa đủ chính xác. Bạn vẫn có thể
              đăng trải nghiệm chưa xác minh — điều đó không có nghĩa trải nghiệm là giả.
            </p>
          ) : null}
          {status === "success" ? (
            <p className="mt-3 text-success">Lần đến đã được xác minh.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

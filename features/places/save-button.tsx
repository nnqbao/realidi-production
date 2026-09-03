"use client";

import { useState, useTransition } from "react";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleSavePlace } from "@/features/social/actions";
import { cn } from "@/lib/utils";

export function SaveButton({
  placeId,
  initialSaved,
  compact = false,
}: {
  placeId: string;
  initialSaved: boolean;
  compact?: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      variant={saved ? "secondary" : compact ? "ghost" : "outline"}
      size={compact ? "icon" : "default"}
      aria-pressed={saved}
      aria-label={saved ? "Bỏ lưu" : "Lưu nơi này"}
      disabled={pending}
      onClick={() => {
        start(async () => {
          try {
            const result = await toggleSavePlace(placeId);
            setSaved(result.saved);
          } catch {
            toast.error("Cần đăng nhập để lưu nơi.");
          }
        });
      }}
      className={cn(saved && "text-brand")}
    >
      <Bookmark className={cn("size-4", saved && "fill-current")} />
      {compact ? null : saved ? "Đã lưu" : "Lưu"}
    </Button>
  );
}

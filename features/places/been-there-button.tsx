"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleBeenThere } from "@/features/social/actions";

export function BeenThereButton({ placeId, initial }: { placeId: string; initial: boolean }) {
  const [been, setBeen] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      className={been ? "border-brand/18" : undefined}
      disabled={pending}
      aria-pressed={been}
      onClick={() => {
        start(async () => {
          try {
            const result = await toggleBeenThere(placeId);
            setBeen(result.beenThere);
          } catch {
            toast.error("Cần đăng nhập để đánh dấu đã đến.");
          }
        });
      }}
    >
      {been ? "Đã ghé" : "Đánh dấu đã ghé"}
    </Button>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleSavePlace } from "@/features/social/actions";
import { cn } from "@/lib/utils";

export function WantToGoButton({
  placeId,
  initial = false,
}: {
  placeId: string;
  initial?: boolean;
}) {
  const [active, setActive] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "outline"}
      aria-pressed={active}
      disabled={pending}
      onClick={() => {
        start(async () => {
          try {
            const result = await toggleSavePlace(placeId, "want_to_go");
            setActive(result.intent === "want_to_go");
          } catch {
            toast.error("Cần đăng nhập để đánh dấu muốn đi.");
          }
        });
      }}
      className={cn(active && "text-brand")}
    >
      <Flag className={cn("size-4", active && "fill-current")} />
      {active ? "Muốn đi" : "Muốn đi"}
    </Button>
  );
}

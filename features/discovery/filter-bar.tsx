"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatCompactVnd } from "@/lib/utils";

const chips = [
  { key: "near", label: "Gần tôi" },
  { key: "budget", label: `Dưới ${formatCompactVnd(300000)}` },
  { key: "time", label: "2 giờ" },
  { key: "quiet", label: "Yên" },
  { key: "solo", label: "Đi một mình" },
];

export function FilterBar({ basePath = "/explore" }: { basePath?: string }) {
  const router = useRouter();
  const params = useSearchParams();

  function toggle(key: string) {
    const next = new URLSearchParams(params.toString());
    if (key === "near") {
      if (next.get("near") === "1") {
        next.delete("near");
        next.delete("lat");
        next.delete("lng");
        apply(next);
        return;
      }
      if (!navigator.geolocation) {
        next.set("near", "manual");
        apply(next);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          next.set("near", "1");
          next.set("lat", String(pos.coords.latitude));
          next.set("lng", String(pos.coords.longitude));
          apply(next);
        },
        () => {
          next.set("near", "denied");
          apply(next);
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 },
      );
      return;
    }
    if (key === "budget") {
      if (next.get("budget") === "300000") next.delete("budget");
      else next.set("budget", "300000");
    } else if (key === "time") {
      if (next.get("time") === "120") next.delete("time");
      else next.set("time", "120");
    } else if (key === "quiet") {
      if (next.get("crowd") === "quiet") next.delete("crowd");
      else next.set("crowd", "quiet");
    } else if (key === "solo") {
      if (next.get("context") === "solo") next.delete("context");
      else next.set("context", "solo");
    }
    apply(next);
  }

  function apply(next: URLSearchParams) {
    router.push(`${basePath}?${next.toString()}`);
  }

  const active = {
    near: params.get("near") === "1",
    budget: params.get("budget") === "300000",
    time: params.get("time") === "120",
    quiet: params.get("crowd") === "quiet",
    solo: params.get("context") === "solo",
  };

  return (
    <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => toggle(chip.key)}
          className={cn(
            "min-h-10 shrink-0 rounded-full border px-3 text-sm",
            active[chip.key as keyof typeof active]
              ? "border-brand bg-brand text-white"
              : "border-brand/12 bg-surface text-brand hover:bg-brand/4",
          )}
          aria-pressed={active[chip.key as keyof typeof active]}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}

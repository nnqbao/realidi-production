"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function FeedSwitcher() {
  const params = useSearchParams();
  const tab = params.get("tab") === "following" ? "following" : "for_you";
  const mood = params.get("mood");
  const qs = (next: string) => {
    const search = new URLSearchParams();
    if (next === "following") search.set("tab", "following");
    if (mood) search.set("mood", mood);
    const s = search.toString();
    return s ? `/home?${s}` : "/home";
  };

  return (
    <div className="sticky top-0 z-10 flex border-b border-border bg-background/90 backdrop-blur md:top-0">
      <Link
        href={qs("for_you")}
        className={cn(
          "flex-1 py-3 text-center text-sm",
          tab === "for_you" ? "border-b-2 border-brand font-semibold text-brand" : "text-inactive",
        )}
      >
        Dành cho bạn
      </Link>
      <Link
        href={qs("following")}
        className={cn(
          "flex-1 py-3 text-center text-sm",
          tab === "following" ? "border-b-2 border-brand font-semibold text-brand" : "text-inactive",
        )}
      >
        Đang theo dõi
      </Link>
    </div>
  );
}

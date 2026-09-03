"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { localizeName, vi } from "@/lib/i18n";
import type { Mood } from "@/types/database";

export function MoodStrip({ moods, selectedId }: { moods: Mood[]; selectedId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function select(id: string | null) {
    const next = new URLSearchParams(params.toString());
    if (!id || id === selectedId) next.delete("mood");
    else next.set("mood", id);
    if (id && id !== selectedId) {
      void fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "mood_selected", properties: { mood_id: id, source: "home" } }),
      });
    }
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <section className="px-4 py-3">
      <p className="text-sm font-medium text-brand">{vi.social.moodPrompt}</p>
      <p className="mt-1 text-xs text-muted-foreground">{vi.social.moodSupport}</p>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {moods.map((mood) => {
          const selected = mood.id === selectedId;
          return (
            <button
              key={mood.id}
              type="button"
              onClick={() => select(mood.id)}
              className={cn(
                "min-h-10 shrink-0 rounded-full border px-3 text-sm",
                selected
                  ? "border-brand bg-brand text-white"
                  : "border-brand/12 bg-surface text-brand hover:bg-brand/4",
              )}
              aria-pressed={selected}
            >
              {localizeName("vi", mood)}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Không bắt buộc.{" "}
        <Link href="/explore" className="underline">
          Khám phá nơi hợp mood
        </Link>
      </p>
    </section>
  );
}

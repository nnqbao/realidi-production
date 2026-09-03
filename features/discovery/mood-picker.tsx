"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { localizeName, type Locale } from "@/lib/i18n";
import type { Mood } from "@/types/database";

export function MoodPicker({
  moods,
  selectedId,
  locale = "vi",
  basePath = "/explore",
}: {
  moods: Mood[];
  selectedId: string | null;
  locale?: Locale;
  basePath?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function select(id: string) {
    const next = new URLSearchParams(params.toString());
    next.set("mood", id);
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "mood_selected", properties: { mood_id: id } }),
    });
    router.push(`${basePath}?${next.toString()}`);
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {moods.map((mood) => {
        const selected = mood.id === selectedId;
        return (
          <button
            key={mood.id}
            type="button"
            onClick={() => select(mood.id)}
            className={cn(
              "min-h-11 shrink-0 rounded-full border px-4 text-sm transition-colors",
              selected
                ? "border-brand bg-brand text-white"
                : "border-brand/12 bg-surface text-brand hover:bg-brand/4",
            )}
            aria-pressed={selected}
          >
            {localizeName(locale, mood)}
          </button>
        );
      })}
    </div>
  );
}

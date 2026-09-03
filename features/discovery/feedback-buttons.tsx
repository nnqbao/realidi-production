"use client";

import { useState, useTransition } from "react";
import { submitRecommendationFeedback } from "@/features/discovery/actions";
import { vi } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function RecommendationFeedback({
  placeId,
  moodId,
}: {
  placeId: string;
  moodId?: string | null;
}) {
  const [choice, setChoice] = useState<"fit" | "wrong_mood" | null>(null);
  const [pending, start] = useTransition();

  function send(kind: "fit" | "wrong_mood") {
    setChoice(kind);
    start(async () => {
      try {
        await submitRecommendationFeedback({ placeId, moodId: moodId ?? null, kind });
      } catch {
        setChoice(null);
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => send("fit")}
        className={cn(
          "rounded-full border px-3 py-1.5 text-xs",
          choice === "fit"
            ? "border-brand bg-brand text-white"
            : "border-brand/12 bg-surface text-brand hover:bg-brand/4",
        )}
      >
        {vi.discover.fit}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => send("wrong_mood")}
        className={cn(
          "rounded-full border px-3 py-1.5 text-xs",
          choice === "wrong_mood"
            ? "border-brand bg-brand text-white"
            : "border-brand/12 bg-surface text-brand hover:bg-brand/4",
        )}
      >
        {vi.discover.wrongMood}
      </button>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { createExperienceAction } from "@/features/experiences/actions";
import { localizeName } from "@/lib/i18n";
import type { Mood } from "@/types/database";

export function CommunityComposer({
  moods,
  onDone,
}: {
  moods: Mood[];
  onDone?: () => void;
}) {
  const [mode, setMode] = useState<"community" | "question">("question");
  const [caption, setCaption] = useState("");
  const [area, setArea] = useState("");
  const [budget, setBudget] = useState("");
  const [moodId, setMoodId] = useState("");
  const [context, setContext] = useState("");
  const [timeLabel, setTimeLabel] = useState("");
  const [crowd, setCrowd] = useState("");
  const [pending, start] = useTransition();

  return (
    <div>
      <h2 className="text-xl font-semibold">Hỏi cộng đồng</h2>
      <p className="mt-1 text-sm text-muted-foreground">Người thật trả lời — Realidi không trả lời hộ.</p>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className={`rounded-full border px-3 py-1.5 text-sm ${mode === "question" ? "border-brand bg-brand text-white" : "border-brand/12"}`}
          onClick={() => setMode("question")}
        >
          Câu hỏi
        </button>
        <button
          type="button"
          className={`rounded-full border px-3 py-1.5 text-sm ${mode === "community" ? "border-brand bg-brand text-white" : "border-brand/12"}`}
          onClick={() => setMode("community")}
        >
          Chia sẻ cộng đồng
        </button>
      </div>
      <Textarea
        className="mt-4 min-h-28"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        maxLength={2000}
        placeholder={
          mode === "question"
            ? "Mình muốn tìm chỗ date tối nay ở Thảo Điền, khoảng 500K/người và không quá ồn."
            : "Ai biết quán nào ở Q1 làm việc sau 22h không?"
        }
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Khu vực
          <Input className="mt-1" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Thảo Điền, Quận 1…" />
        </label>
        <label className="text-sm">
          Ngân sách / người (VND)
          <Input className="mt-1" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="500000" />
        </label>
        <label className="text-sm">
          Thời điểm
          <Input className="mt-1" value={timeLabel} onChange={(e) => setTimeLabel(e.target.value)} placeholder="Tối nay, cuối tuần…" />
        </label>
      </div>
      <div className="mt-4">
        <p className="text-sm font-medium">Mood</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {moods.map((mood) => (
            <button
              key={mood.id}
              type="button"
              onClick={() => setMoodId((id) => (id === mood.id ? "" : mood.id))}
              className={`rounded-full border px-3 py-1.5 text-sm ${moodId === mood.id ? "border-brand bg-brand text-white" : "border-brand/12"}`}
            >
              {localizeName("vi", mood)}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["solo", "couple", "friends"] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setContext((v) => (v === c ? "" : c))}
            className={`rounded-full border px-3 py-1.5 text-sm ${context === c ? "border-brand bg-brand text-white" : "border-brand/12"}`}
          >
            {c === "solo" ? "Một mình" : c === "couple" ? "Hẹn hò" : "Bạn bè"}
          </button>
        ))}
        {(["quiet", "normal"] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCrowd((v) => (v === c ? "" : c))}
            className={`rounded-full border px-3 py-1.5 text-sm ${crowd === c ? "border-brand bg-brand text-white" : "border-brand/12"}`}
          >
            {c === "quiet" ? "Không quá ồn" : "Bình thường"}
          </button>
        ))}
      </div>
      <Button
        className="mt-6"
        disabled={pending || caption.trim().length < 8}
        onClick={() =>
          start(async () => {
            const result = await createExperienceAction({
              postType: mode,
              caption,
              areaLabel: area || null,
              budgetMax: budget ? Number(budget) : null,
              timeLabel: timeLabel || null,
              visitContext: context || null,
              crowdPreference: crowd || null,
              moodRatings: moodId ? [{ moodId, rating: 4 }] : [],
              mediaPaths: [],
            });
            if (result?.error) toast.error("Không đăng được. Thử lại.");
            else onDone?.();
          })
        }
      >
        {pending ? "Đang đăng…" : "Đăng câu hỏi"}
      </Button>
    </div>
  );
}

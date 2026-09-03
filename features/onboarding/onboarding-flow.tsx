"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { completeOnboardingAction, skipOnboardingAction } from "@/features/auth/actions";
import { localizeName } from "@/lib/i18n";
import type { ExperienceStyle, Mood } from "@/types/database";

const contexts = [
  { id: "solo", label: "Một mình" },
  { id: "couple", label: "Hai người" },
  { id: "friends", label: "Bạn bè" },
  { id: "family", label: "Gia đình" },
] as const;

export function OnboardingFlow({
  currentStates,
  desired,
  styles,
}: {
  currentStates: Mood[];
  desired: Mood[];
  styles: ExperienceStyle[];
}) {
  const [step, setStep] = useState(0);
  const [current, setCurrent] = useState<string | null>(null);
  const [moods, setMoods] = useState<string[]>([]);
  const [styleIds, setStyleIds] = useState<string[]>([]);
  const [visit, setVisit] = useState<string[]>([]);
  const [budget, setBudget] = useState("300000");
  const [time, setTime] = useState("120");
  const [pending, start] = useTransition();

  function toggle(list: string[], id: string, max: number) {
    if (list.includes(id)) return list.filter((x) => x !== id);
    if (list.length >= max) return list;
    return [...list, id];
  }

  return (
    <div className="mx-auto max-w-lg">
      <p className="text-sm text-muted-foreground">Tối đa vài câu hỏi · có thể bỏ qua</p>
      <h1 className="mt-2 font-display text-3xl">Vài câu hỏi ngắn để Realidi hiểu bạn hơn</h1>
      <p className="mt-2 text-sm text-muted-foreground">Mood là đầu vào khám phá, không phải chẩn đoán tâm lý.</p>
      {step === 0 ? (
        <div className="mt-6">
          <p className="font-medium">Hôm nay bạn đang thấy thế nào? (không bắt buộc)</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {currentStates.map((m) => (
              <Chip key={m.id} active={current === m.id} onClick={() => setCurrent(m.id)}>
                {localizeName("vi", m)}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}
      {step === 1 ? (
        <div className="mt-6">
          <p className="font-medium">Bạn thường muốn cảm nhận điều gì?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {desired.map((m) => (
              <Chip key={m.id} active={moods.includes(m.id)} onClick={() => setMoods(toggle(moods, m.id, 3))}>
                {localizeName("vi", m)}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}
      {step === 2 ? (
        <div className="mt-6">
          <p className="font-medium">Kiểu trải nghiệm nào hợp với bạn?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {styles.map((s) => (
              <Chip key={s.id} active={styleIds.includes(s.id)} onClick={() => setStyleIds(toggle(styleIds, s.id, 4))}>
                {localizeName("vi", s)}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}
      {step === 3 ? (
        <div className="mt-6">
          <p className="font-medium">Bạn thường đi cùng ai?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {contexts.map((c) => (
              <Chip key={c.id} active={visit.includes(c.id)} onClick={() => setVisit(toggle(visit, c.id, 4))}>
                {c.label}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}
      {step === 4 ? (
        <div className="mt-6 space-y-4">
          <label className="block text-sm font-medium">
            Ngân sách tham khảo (VND)
            <input className="mt-2 w-full" type="range" min={50000} max={1500000} step={50000} value={Number(budget)} onChange={(e) => setBudget(e.target.value)} />
            <span className="text-muted-foreground">{Number(budget).toLocaleString("vi-VN")}</span>
          </label>
          <label className="block text-sm font-medium">
            Thời gian thường có (phút)
            <input className="mt-2 w-full" type="range" min={30} max={240} step={15} value={Number(time)} onChange={(e) => setTime(e.target.value)} />
            <span className="text-muted-foreground">{time} phút</span>
          </label>
        </div>
      ) : null}
      <div className="mt-8 flex flex-wrap gap-2">
        {step > 0 ? (
          <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)}>
            Quay lại
          </Button>
        ) : null}
        {step < 4 ? (
          <Button type="button" onClick={() => setStep((s) => s + 1)}>
            Tiếp
          </Button>
        ) : (
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await completeOnboardingAction({
                  currentStateMoodId: current,
                  desiredMoodIds: moods,
                  styleIds,
                  visitContexts: visit,
                  budgetMax: Number(budget),
                  timeMinutes: Number(time),
                });
              })
            }
          >
            Bắt đầu khám phá
          </Button>
        )}
        <Button type="button" variant="link" onClick={() => start(() => skipOnboardingAction())}>
          Bỏ qua, khám phá ngay
        </Button>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm ${active ? "border-brand bg-brand text-white" : "border-brand/12 bg-surface text-brand hover:bg-brand/4"}`}
    >
      {children}
    </button>
  );
}

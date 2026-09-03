"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { validateMediaFile } from "@/lib/media";
import { createExperienceAction, saveExperienceDraftAction } from "@/features/experiences/actions";
import { localizeName } from "@/lib/i18n";
import type { Mood } from "@/types/database";

type PlaceOption = { id: string; name: string; district: string | null };
type Intent = "photo" | "video" | "check_in" | "mood" | "default";

export function CreateExperienceFlow({
  places,
  moods,
  userId,
  compact = false,
  initialIntent = "default",
}: {
  places: PlaceOption[];
  moods: Mood[];
  userId: string;
  compact?: boolean;
  initialIntent?: Intent;
}) {
  const [step, setStep] = useState(initialIntent === "mood" || initialIntent === "check_in" ? 1 : 0);
  const [files, setFiles] = useState<File[]>([]);
  const [placeId, setPlaceId] = useState("");
  const [caption, setCaption] = useState("");
  const [moodId, setMoodId] = useState("");
  const [moodRating, setMoodRating] = useState(4);
  const [crowd, setCrowd] = useState<"quiet" | "normal" | "busy" | "very_busy" | "">("");
  const [worthIt, setWorthIt] = useState<number | "">("");
  const [spend, setSpend] = useState("");
  const [context, setContext] = useState<"solo" | "couple" | "friends" | "family" | "work" | "other" | "">("");
  const [pending, start] = useTransition();
  const submitting = useRef(false);

  async function uploadAll() {
    const supabase = createClient();
    const paths: string[] = [];
    for (const file of files) {
      const check = validateMediaFile(file, { allowVideo: true });
      if (!check.ok) throw new Error(check.error);
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const blob = file.type.startsWith("image/") ? await (await import("@/lib/media/compress")).compressImage(file) : file;
      const { error } = await supabase.storage.from("experience-media").upload(path, blob, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      paths.push(path);
    }
    return paths;
  }

  function inferType(): "experience" | "check_in" | "photo" | "video" {
    if (initialIntent === "check_in") return "check_in";
    if (files.some((f) => f.type.startsWith("video/"))) return "video";
    if (files.length && !placeId) return "photo";
    if (initialIntent === "photo") return "photo";
    if (initialIntent === "video") return "video";
    return "experience";
  }

  function payload(mediaPaths: string[]) {
    return {
      placeId: placeId || null,
      postType: inferType(),
      caption: caption || null,
      moodRatings: moodId ? [{ moodId, rating: moodRating }] : [],
      crowdLevel: crowd || null,
      worthIt: worthIt === "" ? null : worthIt,
      spendPerPerson: spend ? Number(spend) : null,
      visitContext: context || null,
      mediaPaths,
    };
  }

  const accept =
    initialIntent === "video"
      ? "video/mp4,video/webm"
      : initialIntent === "photo"
        ? "image/jpeg,image/png,image/webp,image/avif"
        : "image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm";

  return (
    <div className={compact ? "" : "mx-auto max-w-lg"}>
      <p className="text-sm text-muted-foreground">Bước {step + 1} / 3 · phần còn lại không bắt buộc</p>
      <h1 className={compact ? "mt-1 text-xl font-semibold" : "mt-1 font-display text-3xl"}>Chia sẻ trải nghiệm</h1>
      {step === 0 ? (
        <div className="mt-6 space-y-4">
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Bạn vừa có trải nghiệm gì?"
            maxLength={2000}
            className="min-h-28"
          />
          <Input
            type="file"
            accept={accept}
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 8))}
          />
          <p className="text-xs text-muted-foreground">{files.length} tệp đã chọn · ảnh hoặc video đều được</p>
        </div>
      ) : null}
      {step === 1 ? (
        <div className="mt-6 space-y-5">
          <div>
            <label className="text-sm font-medium">Thêm nơi (không bắt buộc)</label>
            <select
              className="mt-2 min-h-11 w-full rounded-xl border border-brand/14 bg-surface px-3 text-brand"
              value={placeId}
              onChange={(e) => setPlaceId(e.target.value)}
            >
              <option value="">Chưa gắn nơi</option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.district ? ` · ${p.district}` : ""}
                </option>
              ))}
            </select>
          </div>
          <fieldset>
            <legend className="text-sm font-medium">Mood</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {moods.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMoodId((id) => (id === m.id ? "" : m.id))}
                  className={`rounded-full border px-3 py-2 text-sm ${moodId === m.id ? "border-brand bg-brand text-white" : "border-brand/12 bg-surface text-brand hover:bg-brand/4"}`}
                >
                  {localizeName("vi", m)}
                </button>
              ))}
            </div>
            {moodId ? (
              <input
                className="mt-3 w-full"
                type="range"
                min={1}
                max={5}
                value={moodRating}
                onChange={(e) => setMoodRating(Number(e.target.value))}
                aria-label="Mức độ cảm nhận"
              />
            ) : null}
          </fieldset>
          <fieldset>
            <legend className="text-sm font-medium">Đi cùng ai?</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["solo", "couple", "friends", "family", "work"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setContext((v) => (v === c ? "" : c))}
                  className={`rounded-full border px-3 py-2 text-sm ${context === c ? "border-brand bg-brand text-white" : "border-brand/12 bg-surface text-brand hover:bg-brand/4"}`}
                >
                  {c === "solo" ? "Một mình" : c === "couple" ? "Hai người" : c === "friends" ? "Bạn bè" : c === "family" ? "Gia đình" : "Công việc"}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      ) : null}
      {step === 2 ? (
        <div className="mt-6 space-y-5">
          <p className="text-sm text-muted-foreground">Thêm trí tuệ trải nghiệm nếu bạn muốn — có thể bỏ qua.</p>
          <fieldset>
            <legend className="text-sm font-medium">Mức đông</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["quiet", "normal", "busy", "very_busy"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCrowd((v) => (v === c ? "" : c))}
                  className={`rounded-full border px-3 py-2 text-sm ${crowd === c ? "border-brand bg-brand text-white" : "border-brand/12 bg-surface text-brand hover:bg-brand/4"}`}
                >
                  {c === "quiet" ? "Yên" : c === "normal" ? "Bình thường" : c === "busy" ? "Đông" : "Rất đông"}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-medium">Đáng để đi?</legend>
            <div className="mt-2 flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setWorthIt((v) => (v === n ? "" : n))}
                  className={`size-10 rounded-xl border text-sm ${worthIt === n ? "border-brand bg-brand text-white" : "border-brand/12 bg-surface text-brand hover:bg-brand/4"}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm font-medium">
            Chi khoảng bao nhiêu / người? (VND)
            <Input
              className="mt-2"
              inputMode="numeric"
              value={spend}
              onChange={(e) => setSpend(e.target.value.replace(/[^\d]/g, ""))}
              aria-label="Chi phí mỗi người, chỉ số dương"
            />
          </label>
        </div>
      ) : null}
      <div className="mt-8 flex flex-wrap gap-2">
        {step > 0 ? (
          <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)}>
            Quay lại
          </Button>
        ) : null}
        {step < 2 ? (
          <Button type="button" onClick={() => setStep((s) => s + 1)}>
            Tiếp
          </Button>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              if (submitting.current) return;
              submitting.current = true;
              try {
                const mediaPaths = await uploadAll();
                await saveExperienceDraftAction(payload(mediaPaths));
                toast.success("Đã lưu nháp");
              } catch {
                toast.error("Không lưu nháp được");
              } finally {
                submitting.current = false;
              }
            })
          }
        >
          Lưu nháp
        </Button>
        <Button
          type="button"
          disabled={pending || (!caption && files.length === 0)}
          onClick={() =>
            start(async () => {
              if (submitting.current) return;
              submitting.current = true;
              try {
                const mediaPaths = await uploadAll();
                const result = await createExperienceAction(payload(mediaPaths));
                if (result?.error) toast.error("Không đăng được");
              } catch {
                toast.error("Không đăng được trải nghiệm");
              } finally {
                submitting.current = false;
              }
            })
          }
        >
          Đăng
        </Button>
      </div>
    </div>
  );
}

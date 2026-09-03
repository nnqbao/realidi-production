"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { validateMediaFile } from "@/lib/media";
import { createExperienceAction } from "@/features/experiences/actions";
import { localizeName } from "@/lib/i18n";
import type { Mood } from "@/types/database";

export function CheckInFlow({
  places,
  moods,
  userId,
  initialPlaceId,
  onDone,
}: {
  places: { id: string; name: string; district: string | null }[];
  moods: Mood[];
  userId: string;
  initialPlaceId?: string;
  onDone?: () => void;
}) {
  const [placeId, setPlaceId] = useState(initialPlaceId ?? "");
  const [caption, setCaption] = useState("");
  const [moodId, setMoodId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, start] = useTransition();

  return (
    <div>
      <h2 className="text-xl font-semibold">Check-in</h2>
      <p className="mt-1 text-sm text-muted-foreground">Chọn nơi, thêm vài chữ nếu muốn — đăng ngay.</p>
      <select
        className="mt-4 min-h-11 w-full rounded-xl border border-brand/14 bg-surface px-3"
        value={placeId}
        onChange={(e) => setPlaceId(e.target.value)}
        required
      >
        <option value="">Chọn nơi</option>
        {places.map((place) => (
          <option key={place.id} value={place.id}>
            {place.name}
            {place.district ? ` · ${place.district}` : ""}
          </option>
        ))}
      </select>
      <Textarea
        className="mt-3"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Đang ở đây…"
        maxLength={500}
      />
      <Input
        className="mt-3"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <div className="mt-3 flex flex-wrap gap-2">
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
      <Button
        className="mt-6"
        disabled={pending || !placeId}
        onClick={() =>
          start(async () => {
            try {
              const mediaPaths: string[] = [];
              if (file) {
                const check = validateMediaFile(file);
                if (!check.ok) throw new Error(check.error);
                const supabase = createClient();
                const ext = file.name.split(".").pop() ?? "jpg";
                const path = `${userId}/${crypto.randomUUID()}.${ext}`;
                const { error } = await supabase.storage.from("experience-media").upload(path, file, {
                  contentType: file.type,
                });
                if (error) throw error;
                mediaPaths.push(path);
              }
              const result = await createExperienceAction({
                postType: "check_in",
                placeId,
                caption: caption || null,
                moodRatings: moodId ? [{ moodId, rating: 4 }] : [],
                mediaPaths,
              });
              if (result?.error) toast.error("Không check-in được");
              else onDone?.();
            } catch {
              toast.error("Không check-in được");
            }
          })
        }
      >
        {pending ? "Đang đăng…" : "Check-in"}
      </Button>
    </div>
  );
}

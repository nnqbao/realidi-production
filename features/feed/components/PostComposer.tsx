"use client";

import { useState } from "react";
import { Camera, MapPin, MessageCircleQuestion, Smile, Video } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CreateExperienceFlow } from "@/features/experiences/create-flow";
import { CommunityComposer } from "./CommunityComposer";
import { CheckInFlow } from "./CheckInFlow";
import { mediaSrc } from "@/lib/media";
import type { Mood } from "@/types/database";

type PlaceOption = { id: string; name: string; district: string | null };

export function PostComposer({
  user,
  places,
  moods,
}: {
  user: { id: string; display_name: string; avatar_path: string | null };
  places: PlaceOption[];
  moods: Mood[];
}) {
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<"photo" | "video" | "check_in" | "mood" | "ask" | "default">("default");

  function openWith(next: typeof intent) {
    setIntent(next);
    setOpen(true);
  }

  return (
    <div className="border-b border-border px-4 py-3">
      <button
        type="button"
        onClick={() => openWith("default")}
        className="flex w-full items-center gap-3 rounded-[20px] border border-brand/10 bg-surface px-3 py-2 text-left"
      >
        <span className="inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-sm">
          {user.avatar_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaSrc(user.avatar_path, "avatars") ?? ""} alt="" className="size-full object-cover" />
          ) : (
            user.display_name.slice(0, 1)
          )}
        </span>
        <span className="flex-1 text-sm text-brand/52">Bạn vừa có trải nghiệm gì?</span>
      </button>
      <div className="mt-2 grid grid-cols-5 gap-1 text-[11px] sm:text-xs">
        <Quick action="Ảnh" icon={Camera} onClick={() => openWith("photo")} />
        <Quick action="Video" icon={Video} onClick={() => openWith("video")} />
        <Quick action="Check-in" icon={MapPin} onClick={() => openWith("check_in")} />
        <Quick action="Mood" icon={Smile} onClick={() => openWith("mood")} />
        <Quick action="Hỏi cộng đồng" icon={MessageCircleQuestion} onClick={() => openWith("ask")} />
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-5 pt-12">
          <DialogTitle className="sr-only">Tạo bài viết</DialogTitle>
          {intent === "ask" ? (
            <CommunityComposer moods={moods} onDone={() => setOpen(false)} />
          ) : intent === "check_in" ? (
            <CheckInFlow places={places} moods={moods} userId={user.id} onDone={() => setOpen(false)} />
          ) : (
            <CreateExperienceFlow
              places={places}
              moods={moods}
              userId={user.id}
              compact
              initialIntent={intent}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Quick({ action, icon: Icon, onClick }: { action: string; icon: typeof Camera; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl text-brand hover:bg-brand/4"
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{action}</span>
    </button>
  );
}

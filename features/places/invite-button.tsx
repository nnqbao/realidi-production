"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getShareRecipients, inviteToPlace } from "@/features/messages/actions";

type Person = { id: string; username: string; display_name: string };

export function InviteToPlaceButton({
  placeId,
  placeName,
}: {
  placeId: string;
  placeName: string;
}) {
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function openSheet() {
    setOpen(true);
    start(async () => {
      try {
        setPeople(await getShareRecipients());
      } catch {
        setPeople([]);
      }
    });
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={openSheet}>
        Rủ đi cùng
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-5 pt-12" fullScreenMobile={false}>
          <DialogTitle>Rủ đi {placeName}</DialogTitle>
          <p className="mt-2 text-sm text-muted-foreground">Gửi cho một người đang theo dõi hoặc đã nhắn tin với bạn.</p>
          <label className="mt-4 block text-sm">
            Gợi ý ngày (không bắt buộc)
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3"
            />
          </label>
          <label className="mt-3 block text-sm">
            Giờ (không bắt buộc)
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3"
            />
          </label>
          <label className="mt-3 block text-sm">
            Lời nhắn (không bắt buộc)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={280}
              placeholder="Tối nay được không?"
              className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3"
            />
          </label>
          {people.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Theo dõi ai đó trước để rủ đi cùng.</p>
          ) : (
            <ul className="mt-4 max-h-56 space-y-1 overflow-y-auto">
              {people.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    disabled={pending}
                    className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left hover:bg-muted"
                    onClick={() =>
                      start(async () => {
                        await inviteToPlace({
                          placeId,
                          toUserId: person.id,
                          note: note || null,
                          suggestedDate: date || null,
                          suggestedTime: time || null,
                        });
                        setSent(person.display_name);
                      })
                    }
                  >
                    <span>
                      <span className="block text-sm font-medium">{person.display_name}</span>
                      <span className="text-xs text-muted-foreground">@{person.username}</span>
                    </span>
                    <span className="text-xs text-brand">Gửi</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {sent ? <p className="mt-3 text-sm text-success">Đã gửi lời mời tới {sent}.</p> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

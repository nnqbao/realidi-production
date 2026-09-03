"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckInFlow } from "@/features/feed/components/CheckInFlow";
import type { Mood } from "@/types/database";

export function PlaceCheckInButton({
  place,
  moods,
  userId,
}: {
  place: { id: string; name: string; district: string | null };
  moods: Mood[];
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Check-in
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-5 pt-12">
          <DialogTitle className="sr-only">Check-in {place.name}</DialogTitle>
          <CheckInFlow
            places={[place]}
            moods={moods}
            userId={userId}
            initialPlaceId={place.id}
            onDone={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

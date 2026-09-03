"use client";

import { useState, useTransition } from "react";
import { toggleFollow } from "@/features/social/actions";
import { Button } from "@/components/ui/button";

export function FollowButton({
  userId,
  initial,
  compact = false,
}: {
  userId: string;
  initial: boolean;
  compact?: boolean;
}) {
  const [following, setFollowing] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size={compact ? "sm" : "default"}
      variant={following ? "outline" : "default"}
      className={following ? "border-brand/18" : undefined}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await toggleFollow(userId);
          setFollowing(result.following);
        })
      }
    >
      {following ? "Đang theo dõi" : "Theo dõi"}
    </Button>
  );
}

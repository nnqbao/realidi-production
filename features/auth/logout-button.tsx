"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { logoutAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const { signOut } = useAuthActions();
  return (
    <form
      action={logoutAction}
      onSubmit={() => {
        void signOut();
      }}
    >
      <Button variant="ghost" className="w-full justify-start" type="submit">
        Đăng xuất
      </Button>
    </form>
  );
}

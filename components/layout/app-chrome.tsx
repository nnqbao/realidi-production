"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, MessageCircle, Search } from "lucide-react";
import { logoutAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { PresenceProvider } from "@/features/presence/provider";
import { UserAvatar } from "@/components/ui/user-avatar";
import { DesktopNav, MobileNav } from "./nav-links";
import { RightSidebar } from "./right-sidebar";
import { cn } from "@/lib/utils";
import type { Mood } from "@/types/database";

type Person = { id: string; username: string; display_name: string; avatar_path: string | null; bio?: string | null };
type PlaceLite = { id: string; slug: string; name: string; district: string | null; cover_image_path: string | null };

export function AppChrome({
  children,
  session,
  unread,
  messageUnread,
  people,
  places,
  moods,
  isStaffUser,
  mapEnabled = true,
}: {
  children: ReactNode;
  session: {
    user: { id: string };
    profile: { username: string; display_name: string; avatar_path: string | null; show_activity_status?: boolean };
  } | null;
  unread: number;
  messageUnread: number;
  people: Person[];
  places: PlaceLite[];
  moods: Mood[];
  isStaffUser: boolean;
  mapEnabled?: boolean;
}) {
  const pathname = usePathname();
  const messaging = pathname.startsWith("/messages");
  const onThread = /^\/messages\/[^/]+/.test(pathname);

  return (
    <PresenceProvider userId={session?.user.id} showActivity={session?.profile.show_activity_status !== false}>
    <div className="min-h-dvh bg-background">
      <header
        className={cn(
          "sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:hidden",
          onThread && "hidden",
        )}
      >
        <Link href="/home" className="font-display text-xl text-brand">
          Realidi
        </Link>
        <div className="flex items-center gap-1">
          <Link href="/search" className="inline-flex size-11 items-center justify-center rounded-xl text-brand/60 hover:bg-brand/4" aria-label="Tìm kiếm">
            <Search className="size-5" />
          </Link>
          {session ? (
            <Link href="/messages" className="relative inline-flex size-11 items-center justify-center rounded-xl text-brand/60 hover:bg-brand/4" aria-label="Tin nhắn">
              <MessageCircle className="size-5" />
              {messageUnread > 0 ? <span className="absolute right-2 top-2 size-2 rounded-full bg-brand" /> : null}
            </Link>
          ) : null}
          <Link href="/notifications" className="relative inline-flex size-11 items-center justify-center rounded-xl text-brand/60 hover:bg-brand/4" aria-label="Thông báo">
            <Bell className="size-5" />
            {unread > 0 ? <span className="absolute right-2 top-2 size-2 rounded-full bg-brand" /> : null}
          </Link>
        </div>
      </header>

      <div className={cn("mx-auto flex w-full min-w-0", messaging ? "max-w-none" : "max-w-[1240px]")}>
        <aside className={cn("sticky top-0 h-dvh w-[244px] shrink-0 flex-col px-4 py-6", messaging ? "hidden lg:flex" : "hidden md:flex")}>
          <Link href="/home" className="font-display text-2xl tracking-tight text-brand">
            Realidi
          </Link>
          {!messaging ? (
            <form action="/search" className="mt-5">
              <label className="sr-only" htmlFor="global-search">
                Tìm kiếm
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand/60" />
                <input
                  id="global-search"
                  name="q"
                  placeholder="Tìm kiếm"
                  className="h-10 w-full rounded-xl border border-transparent bg-brand/4 pl-9 pr-3 text-sm text-brand outline-none placeholder:text-brand/42 focus-visible:border-brand"
                />
              </div>
            </form>
          ) : (
            <div className="mt-8" />
          )}
          <DesktopNav unread={unread} messageUnread={messageUnread} mapEnabled={mapEnabled} />
          {session ? (
            <div className="mt-auto space-y-3">
              <Link href={`/user/${session.profile.username}`} className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-brand/4">
                <UserAvatar name={session.profile.display_name} src={session.profile.avatar_path} size={36} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{session.profile.display_name}</span>
                  <span className="block truncate text-xs text-muted-foreground">@{session.profile.username}</span>
                </span>
              </Link>
              <form action={logoutAction}>
                <Button variant="ghost" className="w-full justify-start" type="submit">
                  Đăng xuất
                </Button>
              </form>
              <Link href="/settings" className="px-2 text-xs text-muted-foreground underline">
                Cài đặt
              </Link>
              {isStaffUser ? (
                <Link href="/admin" className="px-2 text-xs text-muted-foreground underline">
                  Quản trị
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="mt-auto flex flex-col gap-2">
              <Button asChild>
                <Link href="/login">Đăng nhập</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/signup">Tạo tài khoản</Link>
              </Button>
            </div>
          )}
        </aside>

        <main
          id="main"
          className={cn(
            "min-w-0 flex-1",
            messaging ? "pb-0 md:max-w-none" : "pb-24 md:max-w-[680px] md:pb-8",
          )}
        >
          <div className={messaging ? "h-full" : "px-0 md:px-2 md:pt-4"}>{children}</div>
        </main>

        {messaging ? null : <RightSidebar people={people} places={places} moods={moods} />}
      </div>

      {onThread ? null : <MobileNav />}
    </div>
    </PresenceProvider>
  );
}

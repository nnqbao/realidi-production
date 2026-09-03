"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Bookmark,
  Compass,
  Home,
  Map,
  MessageCircle,
  Plus,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const desktopNav = [
  { href: "/home", label: "Trang chủ", icon: Home },
  { href: "/explore", label: "Khám phá", icon: Compass },
  { href: "/map", label: "Bản đồ", icon: Map },
  { href: "/create", label: "Đăng", icon: Plus },
  { href: "/saved", label: "Đã lưu", icon: Bookmark },
  { href: "/messages", label: "Tin nhắn", icon: MessageCircle },
  { href: "/notifications", label: "Thông báo", icon: Bell },
] as const;

export const mobileNav = [
  { href: "/home", label: "Trang chủ", icon: Home },
  { href: "/explore", label: "Khám phá", icon: Compass },
  { href: "/create", label: "Đăng", icon: Plus, emphasize: true },
  { href: "/saved", label: "Đã lưu", icon: Bookmark },
  { href: "/me", label: "Hồ sơ", icon: UserRound },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/home") return pathname === "/" || pathname === "/home";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavPendingDot() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <span className="size-1.5 animate-pulse rounded-full bg-brand/50" aria-hidden />;
}

export function DesktopNav({ unread = 0, messageUnread = 0, mapEnabled = true }: { unread?: number; messageUnread?: number; mapEnabled?: boolean }) {
  const pathname = usePathname();
  const items = mapEnabled ? desktopNav : desktopNav.filter((item) => item.href !== "/map");
  return (
    <nav aria-label="Điều hướng chính" className="mt-8 flex flex-1 flex-col gap-1">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const prefetch = item.href === "/home" || item.href === "/explore" || item.href === "/messages" || item.href === "/notifications";
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={prefetch}
            className={cn(
              "relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors",
              active
                ? "bg-brand/6 font-semibold text-brand"
                : "text-brand/72 hover:bg-brand/4",
            )}
          >
            {active ? <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-brand" /> : null}
            <item.icon className="size-5" aria-hidden />
            {item.label}
            <NavPendingDot />
            {item.href === "/notifications" && unread > 0 ? (
              <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[10px] text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
            {item.href === "/messages" && messageUnread > 0 ? (
              <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[10px] text-white">
                {messageUnread > 9 ? "9+" : messageUnread}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-brand/8 bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {mobileNav.map((item) => {
          const active = isActive(pathname, item.href);
          const emphasize = "emphasize" in item && item.emphasize;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px]"
              >
                <span
                  className={cn(
                    "inline-flex items-center justify-center",
                    emphasize && "size-11 -mt-3 rounded-md bg-brand text-white",
                    !emphasize && active && "text-brand",
                    !emphasize && !active && "text-brand/50",
                  )}
                >
                  <item.icon className="size-5" aria-hidden />
                </span>
                <span className={cn(active && !emphasize ? "font-medium text-brand" : "text-brand/50")}>
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

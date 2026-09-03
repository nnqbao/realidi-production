import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatVnd(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCompactVnd(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "";
  if (amount <= 0) return "Miễn phí";
  if (amount >= 1_000_000) {
    const m = amount / 1_000_000;
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)} triệu`;
  }
  if (amount >= 1_000) {
    return `${Math.round(amount / 1_000)}K`;
  }
  return `${amount} VND`;
}

export function formatSpendPerPerson(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "";
  if (amount <= 0) return "Miễn phí";
  return `~${formatCompactVnd(amount)}/người`;
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function formatCompactTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.floor(diff / 60_000));
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

export function formatCity(city: string | null | undefined): string {
  if (!city) return "";
  const normalized = city
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  if (
    normalized === "ho chi minh city" ||
    normalized === "ho chi minh" ||
    normalized === "hcmc" ||
    normalized === "saigon" ||
    normalized === "sai gon" ||
    normalized === "tp.hcm" ||
    normalized === "tp hcm" ||
    normalized === "tp. ho chi minh" ||
    normalized === "thanh pho ho chi minh"
  ) {
    return "TP. Hồ Chí Minh";
  }
  if (normalized === "ha noi" || normalized === "hanoi" || normalized === "ha noi city") {
    return "Hà Nội";
  }
  if (normalized === "da nang" || normalized === "danang") {
    return "Đà Nẵng";
  }
  return city.trim();
}

export function formatDistrict(district: string | null | undefined): string {
  if (!district) return "";
  const raw = district.trim();
  const ascii = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  const numbered = ascii.match(/^(district|quan|q\.?)\s*(\d+)$/i);
  if (numbered) return `Quận ${numbered[2]}`;
  return raw;
}

export function formatPlaceLocation(parts: {
  category?: string | null;
  district?: string | null;
  city?: string | null;
}): string {
  return [parts.category, formatDistrict(parts.district), formatCity(parts.city)].filter(Boolean).join(" · ");
}

export function absoluteUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  if (path.startsWith("http")) return path;
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

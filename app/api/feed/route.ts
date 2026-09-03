import { NextResponse } from "next/server";
import { getFeedPage } from "@/features/feed/queries";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") === "following" ? "following" : "for_you";
  const moodId = url.searchParams.get("mood");
  const cursor = Number(url.searchParams.get("cursor") ?? 0);
  const data = await getFeedPage({ type, moodId, cursor: Number.isFinite(cursor) ? cursor : 0 });
  return NextResponse.json(data);
}

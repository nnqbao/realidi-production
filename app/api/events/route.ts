import { NextResponse } from "next/server";
import { PRODUCT_EVENTS, type ProductEventName } from "@/lib/analytics";
import { recordProductEvent } from "@/features/social/actions";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    event?: string;
    properties?: Record<string, string | number | boolean | null | undefined>;
  };
  if (!body.event || !PRODUCT_EVENTS.includes(body.event as ProductEventName)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  await recordProductEvent(body.event, body.properties ?? {});
  return NextResponse.json({ ok: true });
}

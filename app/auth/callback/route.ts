import { NextResponse } from "next/server";
import { safeReturnPath } from "@/lib/auth/return-to";

/**
 * Legacy Supabase magic-link endpoint. Convex auth uses one-time codes
 * delivered through Mailpit instead. The file stays so the route-surface
 * contract does not change; arriving here always means the link is stale.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  safeReturnPath(searchParams.get("next"), "/home");
  return NextResponse.redirect(`${origin}/login?error=expired`);
}

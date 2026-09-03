import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { safeReturnPath } from "@/lib/auth/return-to";
import { recordProductEvent } from "@/features/social/actions";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeReturnPath(searchParams.get("next"), "/home");
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=expired`);
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=expired`);
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email_confirmed_at) {
    await recordProductEvent("email_verified", {});
  }
  return NextResponse.redirect(`${origin}${next}`);
}

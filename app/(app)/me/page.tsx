import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";

export default async function MePage() {
  const session = await getSessionUser().catch(() => null);
  if (!session) redirect("/login?next=/me");
  redirect(`/user/${session.profile.username}`);
}

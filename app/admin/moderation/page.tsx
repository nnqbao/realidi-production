import { createServerSupabase } from "@/lib/supabase/server";

export default async function AdminModerationPage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("moderation_actions")
    .select("*, profiles(username)")
    .order("created_at", { ascending: false })
    .limit(100);
  return (
    <div>
      <h1 className="font-display text-3xl">Lịch sử kiểm duyệt</h1>
      <ul className="mt-4 space-y-2 text-sm">
        {(data ?? []).map((row) => {
          const action = row as {
            id: string;
            action: string;
            target_type: string;
            reason: string | null;
            created_at: string;
            profiles: { username: string } | null;
          };
          return (
            <li key={action.id} className="rounded-2xl border border-subtle bg-surface px-4 py-3">
              @{action.profiles?.username} · {action.action} · {action.target_type} · {action.reason} · {action.created_at}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

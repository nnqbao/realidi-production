import { api } from "@/convex/_generated/api";
import { convexQueryAuthed } from "@/lib/convex/server";

export default async function AdminModerationPage() {
  const data = await convexQueryAuthed(api.moderation.listActions, {});
  return (
    <div>
      <h1 className="font-display text-3xl">Lịch sử kiểm duyệt</h1>
      <ul className="mt-4 space-y-2 text-sm">
        {data.map((action) => (
          <li key={action.id} className="rounded-2xl border border-subtle bg-surface px-4 py-3">
            @{action.username} · {action.action} · {action.target_type} · {action.reason} · {action.created_at}
          </li>
        ))}
      </ul>
    </div>
  );
}

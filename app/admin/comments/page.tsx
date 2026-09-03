import { createServerSupabase } from "@/lib/supabase/server";
import { adminRemoveComment } from "@/features/admin/actions";
import { Button } from "@/components/ui/button";

export default async function AdminCommentsPage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("comments")
    .select("id, body, created_at, deleted_at, profiles(username)")
    .order("created_at", { ascending: false })
    .limit(80);
  return (
    <div>
      <h1 className="font-display text-3xl">Bình luận</h1>
      <ul className="mt-4 space-y-2">
        {(data ?? []).map((row) => {
          const comment = row as {
            id: string;
            body: string;
            deleted_at: string | null;
            profiles: { username: string } | null;
          };
          return (
            <li key={comment.id} className="rounded-2xl border border-subtle bg-surface p-4">
              <p className="text-sm">@{comment.profiles?.username}</p>
              <p className={comment.deleted_at ? "text-muted-foreground line-through" : ""}>{comment.body}</p>
              {!comment.deleted_at ? (
                <form
                  className="mt-2"
                  action={async () => {
                    "use server";
                    await adminRemoveComment(comment.id);
                  }}
                >
                  <Button size="sm" variant="outline" type="submit">
                    Gỡ
                  </Button>
                </form>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">Đã gỡ</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

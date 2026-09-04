import { api } from "@/convex/_generated/api";
import { convexQueryAuthed } from "@/lib/convex/server";
import { adminRemoveComment } from "@/features/admin/actions";
import { Button } from "@/components/ui/button";

export default async function AdminCommentsPage() {
  const data = await convexQueryAuthed(api.moderation.listComments, {});
  return (
    <div>
      <h1 className="font-display text-3xl">Bình luận</h1>
      <ul className="mt-4 space-y-2">
        {data.map((comment) => (
          <li key={comment.id} className="rounded-2xl border border-subtle bg-surface p-4">
            <p className="text-sm">@{comment.username}</p>
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
        ))}
      </ul>
    </div>
  );
}

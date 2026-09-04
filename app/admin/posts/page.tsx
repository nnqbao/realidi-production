import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { convexQueryAuthed } from "@/lib/convex/server";
import { adminHidePost, adminRestorePost } from "@/features/admin/actions";
import { Button } from "@/components/ui/button";

export default async function AdminPostsPage() {
  const data = await convexQueryAuthed(api.moderation.listPosts, {});
  return (
    <div>
      <h1 className="font-display text-3xl">Trải nghiệm</h1>
      <ul className="mt-4 space-y-2">
        {data.map((row) => (
          <li key={row.id} className="rounded-2xl border border-subtle bg-surface p-4">
            <p className="font-medium">
              {row.placeName} · @{row.username}
            </p>
            <p className="text-sm text-muted-foreground">{row.caption}</p>
            <p className="mt-1 text-xs">
              {row.status} / {row.moderation_status} / {row.verification_status}
            </p>
            <div className="mt-2 flex gap-2">
              <Link className="text-sm underline" href={`/post/${row.id}`}>
                Xem
              </Link>
              <form
                className="flex flex-wrap items-end gap-2"
                action={async (formData) => {
                  "use server";
                  await adminHidePost(row.id, String(formData.get("reason") || "admin_hide"));
                }}
              >
                <input name="reason" placeholder="Lý do ẩn" className="min-h-9 rounded-xl border border-brand/14 px-2 text-sm" required />
                <Button size="sm" variant="outline" type="submit">
                  Ẩn
                </Button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await adminRestorePost(row.id);
                }}
              >
                <Button size="sm" variant="ghost" type="submit">
                  Khôi phục
                </Button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

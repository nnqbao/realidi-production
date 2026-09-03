import { createServerSupabase } from "@/lib/supabase/server";
import { adminSaveCollection, adminSetFeatured } from "@/features/admin/console-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { revalidatePath } from "next/cache";

export default async function AdminCollectionsPage() {
  const supabase = await createServerSupabase();
  const [{ data: collections }, { data: featured }] = await Promise.all([
    supabase.from("editorial_collections").select("*").order("sort_order"),
    supabase.from("featured_placements").select("*").order("sort_order"),
  ]);
  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-3xl">Nội dung nổi bật</h1>
        <p className="mt-1 text-sm text-[#6F7480]">Collection và vị trí Home/Explore. Trạng thái nháp không hiện với người dùng.</p>
      </div>
      <form
        className="max-w-xl space-y-3 rounded-2xl border border-subtle p-4"
        action={async (formData) => {
          "use server";
          await adminSaveCollection({
            slug: String(formData.get("slug")),
            title: String(formData.get("title")),
            description: String(formData.get("description") || ""),
            kind: String(formData.get("kind")) as "place" | "home" | "explore" | "post" | "mood",
            status: String(formData.get("status")) as "draft" | "published" | "archived",
            sortOrder: Number(formData.get("sortOrder") || 0),
          });
          revalidatePath("/admin/collections");
        }}
      >
        <h2 className="font-medium">Tạo collection</h2>
        <Input name="title" placeholder="Tiêu đề" required />
        <Input name="slug" placeholder="slug" required />
        <Input name="description" placeholder="Mô tả" />
        <select name="kind" className="min-h-11 w-full rounded-xl border border-brand/14 px-3">
          <option value="home">home</option>
          <option value="explore">explore</option>
          <option value="place">place</option>
          <option value="post">post</option>
          <option value="mood">mood</option>
        </select>
        <select name="status" className="min-h-11 w-full rounded-xl border border-brand/14 px-3">
          <option value="draft">draft</option>
          <option value="published">published</option>
        </select>
        <Input name="sortOrder" type="number" defaultValue="0" />
        <Button type="submit">Lưu collection</Button>
      </form>
      <ul className="space-y-2">
        {(collections ?? []).map((c) => (
          <li key={c.id} className="rounded-2xl border border-subtle px-4 py-3 text-sm">
            {c.title} · {c.kind} · {c.status}
          </li>
        ))}
      </ul>
      <form
        className="max-w-xl space-y-3 rounded-2xl border border-subtle p-4"
        action={async (formData) => {
          "use server";
          await adminSetFeatured({
            surface: String(formData.get("surface")) as "home" | "explore",
            targetType: String(formData.get("targetType")) as "place" | "post",
            targetId: String(formData.get("targetId")),
            status: String(formData.get("status")) as "draft" | "published",
            sortOrder: Number(formData.get("sortOrder") || 0),
          });
        }}
      >
        <h2 className="font-medium">Ghim nội dung</h2>
        <select name="surface" className="min-h-11 w-full rounded-xl border border-brand/14 px-3">
          <option value="home">home</option>
          <option value="explore">explore</option>
        </select>
        <select name="targetType" className="min-h-11 w-full rounded-xl border border-brand/14 px-3">
          <option value="place">place</option>
          <option value="post">post</option>
        </select>
        <Input name="targetId" placeholder="UUID đối tượng" required />
        <select name="status" className="min-h-11 w-full rounded-xl border border-brand/14 px-3">
          <option value="draft">draft</option>
          <option value="published">published</option>
        </select>
        <Input name="sortOrder" type="number" defaultValue="0" />
        <Button type="submit">Ghim</Button>
      </form>
      <ul className="space-y-2">
        {(featured ?? []).map((f) => (
          <li key={f.id} className="rounded-2xl border border-subtle px-4 py-3 text-sm">
            {f.surface} · {f.target_type} · {f.target_id} · {f.status}
          </li>
        ))}
      </ul>
    </div>
  );
}

import { api } from "@/convex/_generated/api";
import { convexQueryAuthed } from "@/lib/convex/server";

export default async function AdminCategoriesPage() {
  const data = await convexQueryAuthed(api.editorial.listCategories, {});
  return (
    <div>
      <h1 className="font-display text-3xl">Danh mục</h1>
      <ul className="mt-4 space-y-2">
        {data.map((c) => (
          <li key={c.id} className="rounded-2xl border border-subtle bg-surface px-4 py-3">
            {c.name_vi} · {c.slug} · {c.is_active ? "active" : "inactive"}
          </li>
        ))}
      </ul>
    </div>
  );
}

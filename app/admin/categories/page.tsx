import { createServerSupabase } from "@/lib/supabase/server";

export default async function AdminCategoriesPage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("place_categories").select("*").order("sort_order");
  return (
    <div>
      <h1 className="font-display text-3xl">Danh mục</h1>
      <ul className="mt-4 space-y-2">
        {(data ?? []).map((c) => (
          <li key={c.id} className="rounded-2xl border border-subtle bg-surface px-4 py-3">
            {c.name_vi} · {c.slug} · {c.is_active ? "active" : "inactive"}
          </li>
        ))}
      </ul>
    </div>
  );
}

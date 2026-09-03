import { createServerSupabase } from "@/lib/supabase/server";
import { adminUpsertMood } from "@/features/admin/actions";
import { Button } from "@/components/ui/button";

export default async function AdminMoodsPage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("moods").select("*").order("layer").order("sort_order");
  return (
    <div>
      <h1 className="font-display text-3xl">Mood taxonomy</h1>
      <p className="mt-1 text-sm text-muted-foreground">Toàn bộ tên mood đến từ database — không hard-code trong UI.</p>
      <ul className="mt-4 space-y-2">
        {(data ?? []).map((m) => (
          <li key={m.id} className="flex items-center justify-between rounded-2xl border border-subtle bg-surface px-4 py-3">
            <div>
              <p className="font-medium">
                {m.name_vi} <span className="text-muted-foreground">({m.slug})</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {m.layer} · sort {m.sort_order} · {m.is_active ? "active" : "inactive"}
              </p>
            </div>
            <form
              action={async () => {
                "use server";
                await adminUpsertMood({
                  slug: m.slug,
                  layer: m.layer,
                  nameVi: m.name_vi,
                  nameEn: m.name_en,
                  descriptionVi: m.description_vi,
                  descriptionEn: m.description_en,
                  colorToken: m.color_token,
                  isActive: !m.is_active,
                  sortOrder: m.sort_order,
                });
              }}
            >
              <Button type="submit" size="sm" variant="outline">
                {m.is_active ? "Tắt" : "Bật"}
              </Button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { createServerSupabase } from "@/lib/supabase/server";
import { adminToggleFlag } from "@/features/admin/actions";
import { Button } from "@/components/ui/button";

export default async function AdminSettingsPage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("feature_flags").select("*").order("key");
  return (
    <div>
      <h1 className="font-display text-3xl">Cờ tính năng</h1>
      <ul className="mt-4 space-y-2">
        {(data ?? []).map((f) => (
          <li key={f.key} className="flex items-center justify-between rounded-2xl border border-subtle bg-surface px-4 py-3">
            <div>
              <p className="font-medium">{f.key}</p>
              <p className="text-xs text-muted-foreground">{f.description}</p>
            </div>
            <form
              action={async () => {
                "use server";
                await adminToggleFlag(f.key, !f.enabled);
              }}
            >
              <Button type="submit" size="sm" variant={f.enabled ? "secondary" : "outline"}>
                {f.enabled ? "On" : "Off"}
              </Button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}

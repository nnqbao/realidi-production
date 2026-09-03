import { createServerSupabase } from "@/lib/supabase/server";
import { adminVerifyVisit } from "@/features/admin/actions";
import { Button } from "@/components/ui/button";

export default async function AdminVerificationsPage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("visit_verifications")
    .select("id, result, confidence, distance_meters, method, created_at, places(name), profiles(username)")
    .order("created_at", { ascending: false })
    .limit(80);
  return (
    <div>
      <h1 className="font-display text-3xl">Hàng đợi xác minh</h1>
      <p className="mt-1 text-sm text-muted-foreground">Không hiển thị tọa độ thô. Chỉ khoảng cách và độ tin cậy.</p>
      <ul className="mt-4 space-y-2">
        {(data ?? []).map((v) => {
          const row = v as {
            id: string;
            result: string;
            confidence: number;
            distance_meters: number | null;
            method: string;
            places: { name: string } | null;
            profiles: { username: string } | null;
          };
          return (
            <li key={row.id} className="rounded-2xl border border-subtle bg-surface p-4 text-sm">
              <p>
                @{row.profiles?.username} · {row.places?.name}
              </p>
              <p className="text-muted-foreground">
                {row.result} · {row.method} · {row.distance_meters != null ? `${Math.round(row.distance_meters)} m` : "—"} · confidence{" "}
                {Number(row.confidence).toFixed(2)}
              </p>
              <div className="mt-2 flex gap-2">
                <form
                  action={async () => {
                    "use server";
                    await adminVerifyVisit(row.id, true);
                  }}
                >
                  <Button size="sm" type="submit">
                    Admin verify
                  </Button>
                </form>
                <form
                  action={async () => {
                    "use server";
                    await adminVerifyVisit(row.id, false);
                  }}
                >
                  <Button size="sm" variant="outline" type="submit">
                    Từ chối
                  </Button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

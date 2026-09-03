import { getRankingConfig } from "@/features/mood/queries";
import { adminUpdateRanking } from "@/features/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { redirect } from "next/navigation";

export default async function AdminRankingPage() {
  const config = await getRankingConfig();
  return (
    <div className="max-w-lg">
      <h1 className="font-display text-3xl">Cấu hình xếp hạng</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Trọng số phải cộng đúng 1. Thuật toán: 45% mood, 20% trust, 15% freshness, 10% proximity, 10% quality
        engagement. Chi tiết: lib/ranking/ALGORITHM.md
      </p>
      <form
        className="mt-6 space-y-3"
        action={async (formData) => {
          "use server";
          await adminUpdateRanking({
            moodMatchWeight: Number(formData.get("moodMatchWeight")),
            trustWeight: Number(formData.get("trustWeight")),
            freshnessWeight: Number(formData.get("freshnessWeight")),
            proximityWeight: Number(formData.get("proximityWeight")),
            qualityEngagementWeight: Number(formData.get("qualityEngagementWeight")),
            bayesianPriorMean: Number(formData.get("bayesianPriorMean")),
            bayesianPriorStrength: Number(formData.get("bayesianPriorStrength")),
            geofenceRadiusMeters: Number(formData.get("geofenceRadiusMeters")),
          });
          redirect("/admin/ranking");
        }}
      >
        {(
          [
            ["moodMatchWeight", config.moodMatchWeight],
            ["trustWeight", config.trustWeight],
            ["freshnessWeight", config.freshnessWeight],
            ["proximityWeight", config.proximityWeight],
            ["qualityEngagementWeight", config.qualityEngagementWeight],
            ["bayesianPriorMean", config.bayesianPriorMean],
            ["bayesianPriorStrength", config.bayesianPriorStrength],
            ["geofenceRadiusMeters", config.geofenceRadiusMeters],
          ] as const
        ).map(([name, value]) => (
          <div key={name}>
            <Label htmlFor={name}>{name}</Label>
            <Input id={name} name={name} defaultValue={String(value)} className="mt-1" />
          </div>
        ))}
        <Button type="submit">Lưu trọng số</Button>
      </form>
    </div>
  );
}

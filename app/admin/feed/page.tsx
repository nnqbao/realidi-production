import { getFeedRankingConfig } from "@/features/feed/queries";
import { adminUpdateFeedRanking } from "@/features/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { redirect } from "next/navigation";

export default async function AdminFeedPage() {
  const config = await getFeedRankingConfig();
  return (
    <div className="max-w-lg">
      <h1 className="font-display text-3xl">Xếp hạng bảng tin</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Trọng số For You: social 30%, relevance 20%, recency 15%, verified 15%, quality 10%, mood 5%, location 5%.
        Quality: Save &gt; Comment &gt; Share &gt; Like. Không tối ưu watch time.
      </p>
      <form
        className="mt-6 space-y-3"
        action={async (formData) => {
          "use server";
          await adminUpdateFeedRanking({
            socialAffinityWeight: Number(formData.get("socialAffinityWeight")),
            contentRelevanceWeight: Number(formData.get("contentRelevanceWeight")),
            recencyWeight: Number(formData.get("recencyWeight")),
            verifiedWeight: Number(formData.get("verifiedWeight")),
            qualityEngagementWeight: Number(formData.get("qualityEngagementWeight")),
            moodContextWeight: Number(formData.get("moodContextWeight")),
            locationWeight: Number(formData.get("locationWeight")),
          });
          redirect("/admin/feed");
        }}
      >
        {(
          [
            ["socialAffinityWeight", config.socialAffinityWeight],
            ["contentRelevanceWeight", config.contentRelevanceWeight],
            ["recencyWeight", config.recencyWeight],
            ["verifiedWeight", config.verifiedWeight],
            ["qualityEngagementWeight", config.qualityEngagementWeight],
            ["moodContextWeight", config.moodContextWeight],
            ["locationWeight", config.locationWeight],
          ] as const
        ).map(([name, value]) => (
          <div key={name}>
            <Label htmlFor={name}>{name}</Label>
            <Input id={name} name={name} defaultValue={String(value)} className="mt-1" />
          </div>
        ))}
        <Button type="submit">Lưu trọng số bảng tin</Button>
      </form>
    </div>
  );
}

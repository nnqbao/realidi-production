import Link from "next/link";
import { PlaceMiniCard } from "@/features/places/place-mini-card";

export function SharedObjectCard({
  kind,
  payload,
}: {
  kind: string;
  payload: Record<string, unknown>;
}) {
  if (kind === "place" || kind === "invite") {
    const slug = String(payload.placeSlug ?? "");
    const name = String(payload.placeName ?? "Địa điểm");
    return (
      <div>
        {kind === "invite" ? <p className="mb-1 text-xs font-medium text-primary">Lời mời đi cùng</p> : null}
        {slug ? (
          <PlaceMiniCard
            place={{
              slug,
              name,
              district: payload.placeDistrict ? String(payload.placeDistrict) : null,
              categoryName: "Địa điểm",
            }}
          />
        ) : (
          <p className="text-sm">{name}</p>
        )}
        {payload.suggestedDate ? (
          <p className="mt-1 text-xs text-muted-foreground">Gợi ý ngày: {String(payload.suggestedDate)}</p>
        ) : null}
      </div>
    );
  }
  if (kind === "post") {
    return (
      <Link href={`/post/${payload.postId}`} className="mt-2 block rounded-xl border border-border p-3 text-sm hover:bg-muted">
        Bài viết được chia sẻ
      </Link>
    );
  }
  if (kind === "profile") {
    return (
      <Link href={`/user/${payload.username}`} className="mt-2 block rounded-xl border border-border p-3 text-sm hover:bg-muted">
        Hồ sơ @{String(payload.username)}
      </Link>
    );
  }
  return null;
}

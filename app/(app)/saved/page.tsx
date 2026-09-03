import Link from "next/link";
import { getSavedPlaces } from "@/features/places/queries";
import { getSavedPosts } from "@/features/feed/queries";
import { getSessionUser } from "@/lib/auth/session";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { ExperiencePost } from "@/features/feed/components/ExperiencePost";
import { cn } from "@/lib/utils";

export default async function SavedPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab = "all" } = await searchParams;
  const session = await getSessionUser().catch(() => null);
  if (!session) {
    return (
      <EmptyState
        title="Đăng nhập để xem đã lưu"
        description="Lưu bài viết và nơi để quay lại khi bạn muốn đi."
        action={
          <Button asChild>
            <Link href="/login?next=/saved">Đăng nhập</Link>
          </Button>
        }
      />
    );
  }
  const [places, posts] = await Promise.all([getSavedPlaces(), getSavedPosts()]);
  const tabs = [
    { id: "all", label: "Tất cả" },
    { id: "posts", label: "Bài viết" },
    { id: "places", label: "Địa điểm" },
  ];
  const showPosts = tab === "all" || tab === "posts";
  const showPlaces = tab === "all" || tab === "places";
  const empty = (showPosts ? posts.length === 0 : true) && (showPlaces ? places.length === 0 : true);

  return (
    <div className="px-4 py-4">
      <h1 className="text-2xl font-semibold">Đã lưu</h1>
      <div className="mt-4 flex gap-1 border-b border-border">
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={`/saved?tab=${item.id}`}
            className={cn(
              "px-3 py-2 text-sm",
              tab === item.id ? "border-b-2 border-brand font-semibold text-brand" : "text-inactive",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
      {empty ? (
        <EmptyState
          className="mt-6"
          title="Chưa lưu gì"
          description="Lưu bài viết từ bảng tin hoặc lưu nơi khi khám phá."
          action={
            <Button asChild>
              <Link href="/home">Về bảng tin</Link>
            </Button>
          }
        />
      ) : (
        <div className="mt-6 space-y-6">
          {showPosts && posts.length > 0 ? (
            <section className="space-y-4">
              {tab === "all" ? <h2 className="text-sm font-medium text-muted-foreground">Bài viết</h2> : null}
              {posts.map((post) => (
                <ExperiencePost key={post.id} post={post} currentUserId={session.user.id} />
              ))}
            </section>
          ) : null}
          {showPlaces && places.length > 0 ? (
            <section>
              {tab === "all" ? <h2 className="text-sm font-medium text-muted-foreground">Địa điểm</h2> : null}
              <ul className="mt-3 space-y-3">
                {places.map((row) => {
                  const place = (
                    row as {
                      places: {
                        slug: string;
                        name: string;
                        district: string | null;
                        short_description: string | null;
                      } | null;
                    }
                  ).places;
                  if (!place) return null;
                  return (
                    <li key={place.slug}>
                      <Link href={`/place/${place.slug}`} className="block rounded-[20px] border border-subtle bg-surface p-4">
                        <p className="font-medium">{place.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {place.district} · {place.short_description}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

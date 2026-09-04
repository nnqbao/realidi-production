import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { convexQuery } from "@/lib/convex/server";
import { getSessionUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { FollowButton } from "@/features/social/follow-button";
import { MessageButton } from "@/features/messages/message-button";
import { ShareSheet } from "@/features/share/share-sheet";
import { EmptyState } from "@/components/states";
import { ExperiencePost } from "@/features/feed/components/ExperiencePost";
import { getFeedPostsByAuthor, getFollowCounts, getSavedPosts } from "@/features/feed/queries";
import { recordProductEvent } from "@/features/social/actions";
import { ProfileIdentity } from "@/features/profile/profile-identity";
import { formatCity, formatDistrict } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import type { Profile } from "@/types/database";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}`, alternates: { canonical: `/user/${username}` } };
}

export default async function UserPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { username } = await params;
  const { tab = "posts" } = await searchParams;
  const convexPerson = await convexQuery(api.profiles.publicProfile, { username }).catch(() => null);
  if (convexPerson) {
    const session = await getSessionUser().catch(() => null);
    const isMe = session?.profile.username === convexPerson.username;
    return (
      <div className="px-4 py-4">
        <header className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <ProfileIdentity
              person={{
                id: convexPerson.id,
                display_name: convexPerson.displayName,
                username: convexPerson.username,
                avatar_path: convexPerson.avatarUrl,
                bio: convexPerson.bio ?? null,
                home_city: convexPerson.homeCity ?? null,
              }}
            />
          </div>
          {isMe ? (
            <Button asChild variant="outline">
              <Link href="/profile/edit">Sửa hồ sơ</Link>
            </Button>
          ) : null}
        </header>
        <EmptyState className="mt-6" title="Chưa có bài viết công khai" />
      </div>
    );
  }
  if (!isSupabaseConfigured()) notFound();
  const supabase = await createServerSupabase();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .is("deleted_at", null)
    .maybeSingle();
  if (!profile) notFound();
  const person = profile as Profile;
  const session = await getSessionUser().catch(() => null);
  const isMe = session?.user.id === person.id;
  await recordProductEvent("profile_opened", { profile_id: person.id });

  const [posts, counts, { data: following }, { data: prefs }, saved] = await Promise.all([
    getFeedPostsByAuthor(person.id),
    getFollowCounts(person.id),
    session
      ? supabase
          .from("follows")
          .select("follower_id")
          .eq("follower_id", session.user.id)
          .eq("following_id", person.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("user_preferences").select("preferred_mood_ids").eq("user_id", person.id).maybeSingle(),
    isMe ? getSavedPosts() : Promise.resolve([]),
  ]);

  const verified = posts.filter((p) => p.verificationStatus === "verified");
  const places = Array.from(
    new Map(posts.filter((p) => p.place).map((p) => [p.place!.id, p.place!])).values(),
  );

  const tabs = [
    { id: "posts", label: "Bài viết", count: posts.length },
    { id: "places", label: "Đã ghé", count: places.length },
    { id: "verified", label: "Đã xác minh", count: verified.length },
    ...(isMe ? [{ id: "saved", label: "Đã lưu", count: saved.length }] : []),
  ];

  return (
    <div className="px-4 py-4">
      <header className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <ProfileIdentity person={person} />
          <p className="mt-3 text-sm">
            <strong>{posts.length}</strong> bài viết · <strong>{counts.followers}</strong> người theo dõi ·{" "}
            <strong>{counts.following}</strong> đang theo dõi · <strong>{verified.length}</strong> đã xác minh
          </p>
          {prefs?.preferred_mood_ids?.length ? (
            <p className="mt-2 text-xs text-muted-foreground">Phong cách thường chia sẻ đã lưu trong hồ sơ.</p>
          ) : null}
        </div>
        {isMe ? (
          <Button asChild variant="outline">
            <Link href="/profile/edit">Sửa hồ sơ</Link>
          </Button>
        ) : session ? (
          <div className="flex flex-wrap gap-2">
            <FollowButton userId={person.id} initial={Boolean(following)} />
            <MessageButton userId={person.id} />
            <ShareSheet
              path={`/user/${person.username}`}
              kind="profile"
              payload={{ username: person.username }}
              label="Chia sẻ"
            />
          </div>
        ) : null}
      </header>

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={`/user/${username}?tab=${item.id}`}
            className={cn(
              "shrink-0 px-3 py-2 text-sm",
              tab === item.id ? "border-b-2 border-brand font-semibold text-brand" : "text-inactive",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {tab === "places" ? (
        places.length === 0 ? (
          <EmptyState className="mt-6" title="Chưa gắn địa điểm nào" />
        ) : (
          <ul className="mt-6 space-y-2">
            {places.map((place) => (
              <li key={place.id}>
                <Link href={`/place/${place.slug}`} className="block rounded-2xl border border-subtle bg-surface p-4">
                  <p className="font-medium">{place.name}</p>
                  <p className="text-sm text-muted-foreground">{[formatDistrict(place.district), formatCity(place.city)].filter(Boolean).join(" · ")}</p>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : tab === "verified" ? (
        <div className="mt-6 space-y-4">
          {verified.length === 0 ? (
            <EmptyState title="Chưa có trải nghiệm đã xác minh" />
          ) : (
            verified.map((post) => <ExperiencePost key={post.id} post={post} currentUserId={session?.user.id} />)
          )}
        </div>
      ) : tab === "saved" && isMe ? (
        <div className="mt-6 space-y-4">
          {saved.length === 0 ? (
            <EmptyState title="Chưa lưu bài viết nào" />
          ) : (
            saved.map((post) => <ExperiencePost key={post.id} post={post} currentUserId={session?.user.id} />)
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {posts.length === 0 ? (
            <EmptyState title="Chưa có bài viết công khai" />
          ) : (
            posts.map((post) => <ExperiencePost key={post.id} post={post} currentUserId={session?.user.id} />)
          )}
        </div>
      )}
    </div>
  );
}

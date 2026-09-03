import Link from "next/link";
import { searchPlaces } from "@/features/places/queries";
import { searchPeople, searchPosts } from "@/features/feed/queries";
import { searchMoods, searchCategories } from "@/features/discovery/queries";
import { getCategories } from "@/features/mood/queries";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState } from "@/components/states";
import { ExperiencePost } from "@/features/feed/components/ExperiencePost";
import { localizeName, vi } from "@/lib/i18n";
import { getSessionUser } from "@/lib/auth/session";
import { recordProductEvent } from "@/features/social/actions";
import { PeopleResultRow } from "@/features/search/people-result-row";
import { parseSearchIntent } from "@/lib/search";
import { cn } from "@/lib/utils";
import type { FeedPost } from "@/features/feed/types";
import type { PlaceCategory } from "@/types/database";

type SearchPerson = { id: string; username: string; display_name: string; avatar_path: string | null };
type SearchMood = { id: string; name_vi: string };
type SearchCategory = { id: string; name_vi: string };
type SearchPlace = {
  id: string;
  slug: string;
  name: string;
  district: string | null;
  short_description: string | null;
};

async function loadSearch(query: string, tab: string) {
  const [categories, session] = await Promise.all([
    getCategories().catch(() => []),
    getSessionUser().catch(() => null),
  ]);
  const [places, people, posts, moods, matchedCategories] = query
    ? await Promise.all([
        searchPlaces(query).catch(() => []),
        searchPeople(query).catch(() => []),
        searchPosts(query).catch(() => []),
        searchMoods(query).catch(() => []),
        searchCategories(query).catch(() => []),
      ])
    : [[], [], [], [], []];
  if (query) {
    await recordProductEvent("search_performed", { q: query, tab, mode: "keyword" });
  }
  return {
    categories,
    session,
    places: places as SearchPlace[],
    people: people as SearchPerson[],
    posts: posts as FeedPost[],
    moods: moods as SearchMood[],
    matchedCategories: matchedCategories as SearchCategory[],
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q = "", tab = "all" } = await searchParams;
  const intent = parseSearchIntent(q);
  const query = intent.text;

  let data: Awaited<ReturnType<typeof loadSearch>>;
  try {
    data = await loadSearch(query, tab);
  } catch {
    return <ErrorState title="Không tìm được kết quả" description="Thử lại sau, hoặc đổi từ khóa ngắn hơn." />;
  }

  const { categories, session, places, people, posts, moods, matchedCategories } = data;
  const tabs = [
    { id: "all", label: "Tất cả" },
    { id: "places", label: vi.search.places },
    { id: "moods", label: vi.search.moods },
    { id: "categories", label: "Loại hình" },
    { id: "people", label: "Người" },
    { id: "posts", label: vi.search.posts },
  ];
  const show = (id: string) => tab === "all" || tab === id;
  const empty =
    Boolean(query) &&
    (show("places") ? places.length === 0 : true) &&
    (show("moods") ? moods.length === 0 : true) &&
    (show("categories") ? matchedCategories.length === 0 : true) &&
    (show("people") ? people.length === 0 : true) &&
    (show("posts") ? posts.length === 0 : true);

  return (
    <div className="px-4 py-4">
      <h1 className="text-2xl font-semibold">Tìm kiếm</h1>
      <form className="mt-4">
        <Input name="q" defaultValue={q} placeholder={vi.search.placeholder} aria-label="Tìm kiếm" />
        <input type="hidden" name="tab" value={tab} />
      </form>
      <div className="mt-4 flex gap-1 overflow-x-auto border-b border-border [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={`/search?q=${encodeURIComponent(q)}&tab=${item.id}`}
            className={cn(
              "shrink-0 px-3 py-2 text-sm",
              tab === item.id ? "border-b-2 border-brand font-semibold text-brand" : "text-inactive",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
      {!query ? (
        <section className="mt-8">
          <h2 className="text-sm font-medium text-muted-foreground">{vi.search.categories}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.map((c: PlaceCategory) => (
              <Link
                key={c.id}
                href={`/explore?category=${c.id}`}
                className="rounded-full border border-brand/12 bg-surface px-4 py-2 text-sm text-brand hover:bg-brand/4"
              >
                {localizeName("vi", c)}
              </Link>
            ))}
          </div>
        </section>
      ) : empty ? (
        <EmptyState className="mt-8" title="Không thấy kết quả" description={vi.search.empty} />
      ) : (
        <div className="mt-6 space-y-8">
          {show("places") && places.length > 0 ? (
            <section>
              <h2 className="text-sm font-medium text-muted-foreground">{vi.search.places}</h2>
              <ul className="mt-3 space-y-2">
                {places.map((place) => (
                  <li key={place.id}>
                    <Link href={`/place/${place.slug}`} className="block rounded-[20px] border border-subtle bg-surface p-4">
                      <p className="font-medium">{place.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {[place.district, place.short_description].filter(Boolean).join(" · ")}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {show("moods") && moods.length > 0 ? (
            <section>
              <h2 className="text-sm font-medium text-muted-foreground">{vi.search.moods}</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {moods.map((mood) => (
                  <li key={mood.id}>
                    <Link
                      href={`/explore?mood=${mood.id}`}
                      className="block rounded-full border border-brand/12 bg-surface px-4 py-2 text-sm text-brand"
                    >
                      {mood.name_vi}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {show("categories") && matchedCategories.length > 0 ? (
            <section>
              <h2 className="text-sm font-medium text-muted-foreground">Loại hình</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {matchedCategories.map((category) => (
                  <li key={category.id}>
                    <Link
                      href={`/explore?category=${category.id}`}
                      className="block rounded-full border border-brand/12 bg-surface px-4 py-2 text-sm text-brand"
                    >
                      {category.name_vi}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {show("people") && people.length > 0 ? (
            <section>
              <h2 className="text-sm font-medium text-muted-foreground">Người</h2>
              <ul className="mt-3 space-y-2">
                {people.map((person) => (
                  <li key={person.id}>
                    <PeopleResultRow person={person} currentUserId={session?.user.id} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {show("posts") && posts.length > 0 ? (
            <section className="space-y-4">
              <h2 className="text-sm font-medium text-muted-foreground">{vi.search.posts}</h2>
              {posts.map((post) => (
                <ExperiencePost key={post.id} post={post} currentUserId={session?.user.id} />
              ))}
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

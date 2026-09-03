import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getFeedPostById, getRelatedPosts, getAuthorPosts } from "@/features/feed/queries";
import { ExperiencePost } from "@/features/feed/components/ExperiencePost";
import { CommentForm } from "@/features/social/comment-form";
import { CommentsSection, type CommentItem } from "@/features/social/comments-section";
import { getSessionUser } from "@/lib/auth/session";
import { VerifyVisitButton } from "@/features/verification/verify-button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: "Trải nghiệm", alternates: { canonical: `/post/${id}` } };
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getFeedPostById(id).catch(() => null);
  if (!post) notFound();
  const session = await getSessionUser().catch(() => null);
  const community = post.type === "question" || post.type === "community";
  const supabase = await createServerSupabase();
  const attachPlaces = community
    ? ((await supabase.from("places").select("id, name, district").eq("status", "active").order("name").limit(40)).data ?? [])
    : [];
  const [{ data: commentRows, error: commentError }, related, more] = await Promise.all([
    supabase
      .from("comments")
      .select("id, body, author_id, parent_id, place_id, created_at")
      .eq("post_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    getRelatedPosts(post).catch(() => []),
    getAuthorPosts(post.author.id, post.id).catch(() => []),
  ]);
  const comments = commentRows ?? [];
  const authorIds = [...new Set(comments.map((row) => row.author_id))];
  const placeIds = [...new Set(comments.map((row) => row.place_id).filter(Boolean))] as string[];
  const [{ data: authors }, { data: commentPlaces }] = await Promise.all([
    authorIds.length
      ? supabase.from("profiles").select("id, username, display_name").in("id", authorIds)
      : Promise.resolve({ data: [] as Array<{ id: string; username: string; display_name: string }> }),
    placeIds.length
      ? supabase.from("places").select("id, slug, name, district").in("id", placeIds)
      : Promise.resolve({ data: [] as Array<{ id: string; slug: string; name: string; district: string | null }> }),
  ]);
  const authorById = new Map((authors ?? []).map((a) => [a.id, a]));
  const placeById = new Map((commentPlaces ?? []).map((p) => [p.id, p]));
  const items: CommentItem[] = comments.map((row) => ({
    id: row.id,
    body: row.body,
    author_id: row.author_id,
    parent_id: row.parent_id,
    place_id: row.place_id,
    profiles: authorById.get(row.author_id) ?? null,
    attached: row.place_id ? placeById.get(row.place_id) ?? null : null,
  }));

  return (
    <article className="px-0 pb-10 md:px-0">
      <ExperiencePost post={post} currentUserId={session?.user.id} />
      {session?.user.id === post.author.id && post.place && post.verificationStatus !== "verified" ? (
        <div className="mt-4 px-4">
          <VerifyVisitButton placeId={post.place.id} postId={post.id} />
        </div>
      ) : null}
      <section className="mt-8 px-4">
        <h2 className="text-lg font-semibold">Bình luận</h2>
        {commentError ? (
          <p className="mt-3 text-sm text-destructive">Không tải được bình luận. Thử tải lại trang.</p>
        ) : (
          <CommentsSection comments={items} currentUserId={session?.user.id} />
        )}
        {session ? (
          <CommentForm postId={id} allowPlace={community} places={attachPlaces} />
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Đăng nhập để bình luận.</p>
        )}
      </section>
      {related.length > 0 ? (
        <section className="mt-10 space-y-4">
          <h2 className="px-4 text-lg font-semibold">Bài liên quan</h2>
          {related.map((item) => (
            <ExperiencePost key={item.id} post={item} currentUserId={session?.user.id} />
          ))}
        </section>
      ) : null}
      {more.length > 0 ? (
        <section className="mt-10 space-y-4">
          <h2 className="px-4 text-lg font-semibold">Thêm từ {post.author.display_name}</h2>
          {more.map((item) => (
            <ExperiencePost key={item.id} post={item} currentUserId={session?.user.id} />
          ))}
        </section>
      ) : null}
    </article>
  );
}

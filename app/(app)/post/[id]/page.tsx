import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getAuthorPosts,
  getCommentsForPost,
  getFeedPostById,
  getPlacesLite,
  getRelatedPosts,
} from "@/features/feed/queries";
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
  const [attachPlaces, items, related, more] = await Promise.all([
    community ? getPlacesLite().catch(() => []) : Promise.resolve([]),
    getCommentsForPost(id).catch(() => []),
    getRelatedPosts(post).catch(() => []),
    getAuthorPosts(post.author.id, post.id).catch(() => []),
  ]);

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
        <CommentsSection comments={items as CommentItem[]} currentUserId={session?.user.id} />
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

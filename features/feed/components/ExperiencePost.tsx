"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MessageCircle, MapPin } from "lucide-react";
import { FollowButton } from "@/features/social/follow-button";
import { LikeButton } from "@/features/social/like-button";
import { SavePostButton } from "./save-post-button";
import { PostMedia } from "./PostMedia";
import { UserAvatar } from "@/components/ui/user-avatar";
import { formatCompactTime, formatSpendPerPerson, formatPlaceLocation } from "@/lib/utils";
import { vi } from "@/lib/i18n";
import { WhyThisPost } from "./WhyThisPost";
import { ShareSheet } from "@/features/share/share-sheet";
import { PostSafetyMenu } from "./post-safety-menu";
import type { FeedPost } from "../types";

const contextLabel: Record<string, string> = {
  solo: "Đi một mình",
  couple: "Đi cùng người yêu",
  friends: "Đi cùng bạn",
  family: "Đi cùng gia đình",
  work: "Công việc",
  other: "Cùng người khác",
};

const crowdLabel: Record<string, string> = {
  quiet: "Yên",
  normal: "Không quá đông",
  busy: "Đông",
  very_busy: "Rất đông",
};

export function ExperiencePost({
  post,
  currentUserId,
  feedType,
}: {
  post: FeedPost;
  currentUserId?: string | null;
  feedType?: "for_you" | "following";
}) {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const caption = post.caption ?? "";
  const long = caption.length > 180;
  const shown = !long || expanded ? caption : `${caption.slice(0, 180).trim()}…`;
  const isOwner = currentUserId === post.author.id;
  const contextLine = post.place
    ? post.type === "check_in"
      ? `đang ở ${post.place.name}`
      : `đã ghé ${post.place.name}`
    : post.type === "question"
      ? "đang hỏi cộng đồng"
      : post.type === "community"
        ? "chia sẻ với cộng đồng"
        : "chia sẻ một trải nghiệm";

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        void fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "post_impression",
            properties: {
              post_id: post.id,
              author_id: post.author.id,
              position: post.position,
              feed_type: feedType ?? "for_you",
              source: "feed",
            },
          }),
        });
        if (post.verificationStatus === "verified") {
          void fetch("/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: "verified_post_viewed",
              properties: { post_id: post.id },
            }),
          });
        }
        io.disconnect();
      },
      { threshold: 0.45 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [post, feedType]);

  return (
    <article ref={ref} className="overflow-hidden rounded-[20px] border border-brand/8 bg-surface shadow-[var(--shadow-card)]">
      <header className="flex items-start gap-3 px-4 pt-4">
        <Link href={`/user/${post.author.username}`} className="shrink-0">
          <UserAvatar name={post.author.display_name} src={post.author.avatar_path} size={44} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link href={`/user/${post.author.username}`} className="truncate font-semibold">
              {post.author.display_name}
            </Link>
            <span className="text-sm text-muted-foreground">{formatCompactTime(post.publishedAt ?? post.createdAt)}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            @{post.author.username} · {contextLine}
          </p>
        </div>
        {!isOwner && currentUserId && !post.followingAuthor ? (
          <FollowButton userId={post.author.id} initial={false} compact />
        ) : null}
        {feedType === "for_you" ? (
          <WhyThisPost
            postId={post.id}
            reasons={post.reasons}
            authorName={post.author.display_name}
            moodName={post.mood?.name_vi}
          />
        ) : null}
        <PostSafetyMenu postId={post.id} authorId={post.author.id} currentUserId={currentUserId} />
      </header>

      {caption ? (
        <div className="px-4 pt-3">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{shown}</p>
          {long ? (
            <button type="button" className="mt-1 text-sm text-muted-foreground" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Thu gọn" : "Xem thêm"}
            </button>
          ) : null}
        </div>
      ) : null}

      {post.media.length ? (
        <div className="mt-3">
          <PostMedia media={post.media} />
        </div>
      ) : null}

      {post.areaLabel && !post.place ? (
        <p className="px-4 pt-2 text-sm text-muted-foreground">Khu vực: {post.areaLabel}</p>
      ) : null}

      {post.place ? (
        <Link
          href={`/place/${post.place.slug}`}
          className="mx-4 mt-3 flex items-center gap-2 rounded-2xl bg-brand/4 px-3 py-2 text-sm"
          onClick={() => {
            void fetch("/api/events", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                event: "place_opened_from_post",
                properties: { place_id: post.place!.id, post_id: post.id },
              }),
            });
          }}
        >
          <MapPin className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0">
            <span className="font-medium">{post.place.name}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {formatPlaceLocation({ category: post.place.categoryName, district: post.place.district, city: post.place.city })}
            </span>
          </span>
        </Link>
      ) : null}

      <TravelMeta post={post} />

      <footer className="flex flex-wrap items-center gap-3 px-4 py-2">
        <LikeButton postId={post.id} initial={post.liked} count={post.likeCount} signedIn={Boolean(currentUserId)} />
        <Link
          href={currentUserId ? `/post/${post.id}` : `/login?next=${encodeURIComponent(`/post/${post.id}`)}`}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm text-brand/68 hover:text-brand"
          aria-label="Bình luận"
          onClick={() => {
            void fetch("/api/events", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                event: "post_opened",
                properties: { post_id: post.id, author_id: post.author.id, feed_type: feedType ?? "detail" },
              }),
            });
          }}
        >
          <MessageCircle className="size-5" />
          <span>Bình luận</span>
          {post.commentCount > 0 ? <span>{post.commentCount}</span> : null}
        </Link>
        <SavePostButton postId={post.id} initial={post.saved} count={post.saveCount} signedIn={Boolean(currentUserId)} />
        <ShareSheet path={`/post/${post.id}`} kind="post" postId={post.id} payload={{ postId: post.id }} />
      </footer>
      {post.likeCount > 0 || post.commentCount > 0 ? (
        <p className="px-4 pb-3 text-xs text-[#6F7480]">
          {[post.likeCount > 0 ? `${post.likeCount} lượt thích` : null, post.commentCount > 0 ? `${post.commentCount} bình luận` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}
    </article>
  );
}

function TravelMeta({ post }: { post: FeedPost }) {
  const chips: string[] = [];
  if (post.mood) chips.push(post.mood.name_vi);
  if (post.question?.budgetMax) chips.push(`Dưới ${formatSpendPerPerson(post.question.budgetMax).replace("~", "")}`);
  if (post.question?.timeLabel) chips.push(post.question.timeLabel);
  if (post.metrics.visitContext) chips.push(contextLabel[post.metrics.visitContext] ?? post.metrics.visitContext);
  if (post.metrics.spendPerPerson != null) {
    chips.push(formatSpendPerPerson(post.metrics.spendPerPerson));
  }
  if (post.metrics.crowd) chips.push(crowdLabel[post.metrics.crowd] ?? post.metrics.crowd);
  const verified = post.verificationStatus === "verified";
  if (!chips.length && !verified) return null;
  return (
    <div className="flex flex-wrap gap-2 px-4 pt-3 text-xs text-muted-foreground">
      {chips.map((chip) => (
        <span key={chip} className="rounded-full border border-brand/12 bg-surface px-2.5 py-1 text-brand">
          {chip}
        </span>
      ))}
      {verified ? (
        <span className="rounded-full bg-success/12 px-2.5 py-1 text-success">
          ✓ {vi.social.verified}
        </span>
      ) : null}
    </div>
  );
}

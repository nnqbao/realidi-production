import type { FeedPostInput } from "./types";
import type { FeedReason } from "@/types/database";

export function explainFeedPost(post: FeedPostInput): FeedReason[] {
  const reasons: FeedReason[] = [];
  if (post.followsAuthor) reasons.push("FOLLOWED_AUTHOR");
  if (post.moodMatch) reasons.push("SELECTED_MOOD");
  if (post.savedPlaceMatch) reasons.push("SIMILAR_TO_SAVED_PLACE");
  if (post.verified) reasons.push("VERIFIED_EXPERIENCE");
  if (post.tasteMatch) reasons.push("MATCHED_INTEREST");
  if (post.nearbyPopular) reasons.push("POPULAR_NEARBY");
  if (post.isQuestion) reasons.push("COMMUNITY_QUESTION");
  if (post.commentCount + post.saveCount >= 3) reasons.push("QUALITY_ENGAGEMENT");
  return reasons.slice(0, 2);
}

export function feedReasonCopy(
  reason: FeedReason,
  ctx: { authorName?: string | null; moodName?: string | null },
): string {
  switch (reason) {
    case "FOLLOWED_AUTHOR":
      return ctx.authorName ? `Bạn đang theo dõi ${ctx.authorName}.` : "Bạn đang theo dõi người viết.";
    case "SELECTED_MOOD":
      return ctx.moodName ? `Bạn đang quan tâm mood ${ctx.moodName}.` : "Khớp mood bạn đang chọn.";
    case "SIMILAR_TO_SAVED_PLACE":
      return "Bạn thường lưu những nơi tương tự.";
    case "VERIFIED_EXPERIENCE":
      return "Trải nghiệm đã được xác minh.";
    case "MATCHED_INTEREST":
      return "Hợp với những gì bạn đang quan tâm.";
    case "POPULAR_NEARBY":
      return "Địa điểm này đang được quan tâm gần bạn.";
    case "COMMUNITY_QUESTION":
      return "Câu hỏi từ cộng đồng.";
    case "QUALITY_ENGAGEMENT":
      return "Đang được cộng đồng thảo luận.";
    default:
      return "Gợi ý cho bạn trên Realidi.";
  }
}

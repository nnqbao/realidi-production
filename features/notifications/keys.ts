export type NotificationKind =
  | "new_follower"
  | "post_like"
  | "post_comment"
  | "comment_reply"
  | "post_saved"
  | "community_answer"
  | "message"
  | "place_invite";

export function notificationIdempotencyKey(input: {
  type: NotificationKind;
  actorId: string;
  recipientId: string;
  postId?: string | null;
  commentId?: string | null;
  conversationId?: string | null;
  invitationId?: string | null;
  messageId?: string | null;
}): string | null {
  switch (input.type) {
    case "message":
      return input.messageId ? `message:${input.messageId}` : null;
    case "post_like":
      return input.postId ? `like:${input.postId}:${input.actorId}` : null;
    case "post_saved":
      return input.postId ? `save:${input.postId}:${input.actorId}` : null;
    case "post_comment":
    case "comment_reply":
    case "community_answer":
      return input.commentId ? `comment:${input.commentId}` : null;
    case "new_follower":
      return `follow:${input.actorId}:${input.recipientId}`;
    case "place_invite":
      return input.invitationId ? `invite:${input.invitationId}` : null;
    default:
      return null;
  }
}

export function messageNotificationCopy(count = 1): string {
  if (count <= 1) return "đã gửi cho bạn một tin nhắn";
  return `đã gửi ${count} tin nhắn`;
}

export function notificationHref(item: {
  type: string;
  post_id?: string | null;
  comment_id?: string | null;
  metadata?: { conversation_id?: string } | null;
  profiles?: { username?: string } | null;
}): string {
  if (item.type === "message" && item.metadata?.conversation_id) {
    return `/messages/${item.metadata.conversation_id}`;
  }
  if (item.post_id && item.comment_id) {
    return `/post/${item.post_id}#comment-${item.comment_id}`;
  }
  if (item.post_id) return `/post/${item.post_id}`;
  if (item.profiles?.username) return `/user/${item.profiles.username}`;
  return "/home";
}

export const GROUP_GAP_MS = 5 * 60_000;

export type ChatKind = "text" | "post" | "place" | "profile" | "invite" | "image" | "system";

export type InviteStatus = "pending" | "accepted" | "maybe" | "declined";

export type ProfileLite = {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  bio?: string | null;
  last_seen_at?: string | null;
  last_active_at?: string | null;
  show_activity_status?: boolean;
};

export type ConversationPreview = {
  id: string;
  other: ProfileLite | null;
  last: {
    id: string;
    body: string | null;
    kind: string;
    sender_id: string;
    created_at: string;
    deleted_at?: string | null;
  } | null;
  unread: boolean;
  lastAt: string | null;
  muted: boolean;
};

export type SharedPostPreview = {
  id: string;
  caption: string | null;
  verificationStatus: string;
  author: { username: string; display_name: string; avatar_path: string | null };
  placeName: string | null;
  thumbnail: string | null;
} | null;

export type SharedPlacePreview = {
  id: string;
  slug: string;
  name: string;
  district: string | null;
  categoryName: string | null;
  cover: string | null;
  moodName: string | null;
  spendLabel: string | null;
  verified: boolean;
} | null;

export type SharedProfilePreview = {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  bio: string | null;
  followers: number | null;
} | null;

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  kind: ChatKind;
  payload: Record<string, unknown>;
  created_at: string;
  deleted_at: string | null;
  edited_at: string | null;
  client_id: string | null;
  reply_to_message_id: string | null;
  reply: { id: string; body: string | null; kind: string; senderName: string | null } | null;
  sender: ProfileLite | null;
  reactions: Array<{ reaction: string; count: number; mine: boolean }>;
  imageUrl: string | null;
  post: SharedPostPreview;
  place: SharedPlacePreview;
  profile: SharedProfilePreview;
  invite: {
    invitationId: string | null;
    status: InviteStatus;
    suggestedDate: string | null;
    suggestedTime: string | null;
    note: string | null;
  } | null;
  status?: "sending" | "sent" | "failed";
};

export type ThreadPage = {
  messages: ChatMessage[];
  nextCursor: string | null;
  typing: boolean;
  peerLastReadAt: string | null;
  muted: boolean;
  blocked: boolean;
  blockedByMe: boolean;
};

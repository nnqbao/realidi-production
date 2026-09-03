"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { mediaSrc, optimizedImageSrc } from "@/lib/media";
import { formatSpendPerPerson } from "@/lib/utils";
import type {
  ChatKind,
  ChatMessage,
  ConversationPreview,
  InviteStatus,
  ProfileLite,
  SharedPlacePreview,
  SharedPostPreview,
  SharedProfilePreview,
  ThreadPage,
} from "./types";

const PAGE = 40;

export async function listConversations(): Promise<ConversationPreview[]> {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  const { data: mine } = await supabase
    .from("conversation_participants")
    .select("conversation_id, last_read_at, muted")
    .eq("user_id", user.id);
  const ids = (mine ?? []).map((row) => row.conversation_id);
  if (!ids.length) return [];
  const [{ data: participants }, { data: convos }, { data: lastMessages }] = await Promise.all([
    supabase.from("conversation_participants").select("conversation_id, user_id, last_read_at, muted").in("conversation_id", ids),
    supabase.from("conversations").select("id, last_message_at").in("id", ids),
    supabase
      .from("messages")
      .select("id, conversation_id, body, kind, sender_id, created_at, deleted_at")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false })
      .limit(300),
  ]);
  const otherIds = [...new Set((participants ?? []).map((p) => p.user_id).filter((id) => id !== user.id))];
  const { data: profiles } = otherIds.length
    ? await supabase.from("profiles").select("id, username, display_name, avatar_path, last_seen_at, last_active_at, show_activity_status").in("id", otherIds)
    : { data: [] as ProfileLite[] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p as ProfileLite]));
  const lastByConv = new Map<string, NonNullable<typeof lastMessages>[number]>();
  for (const msg of lastMessages ?? []) {
    if (!lastByConv.has(msg.conversation_id)) lastByConv.set(msg.conversation_id, msg);
  }
  const lastAtByConv = new Map((convos ?? []).map((c) => [c.id, c.last_message_at]));
  return ids
    .map((id) => {
      const people = (participants ?? []).filter((p) => p.conversation_id === id);
      const otherId = people.find((p) => p.user_id !== user.id)?.user_id;
      const me = people.find((p) => p.user_id === user.id);
      const last = lastByConv.get(id) ?? null;
      const unread = Boolean(
        last && !last.deleted_at && last.sender_id !== user.id && (!me?.last_read_at || last.created_at > me.last_read_at),
      );
      return {
        id,
        other: otherId ? profileById.get(otherId) ?? null : null,
        last,
        unread,
        lastAt: lastAtByConv.get(id) ?? last?.created_at ?? null,
        muted: Boolean(me?.muted),
      };
    })
    .sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
}

export async function getUnreadMessageCount() {
  const session = await requireUser().catch(() => null);
  if (!session) return 0;
  const list = await listConversations().catch(() => []);
  return list.filter((c) => c.unread).length;
}

export async function getConversationPeer(conversationId: string) {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  const { data: rows } = await supabase
    .from("conversation_participants")
    .select("user_id, muted, last_read_at")
    .eq("conversation_id", conversationId);
  if (!(rows ?? []).some((r) => r.user_id === user.id)) return null;
  const otherId = (rows ?? []).map((r) => r.user_id).find((id) => id !== user.id);
  if (!otherId) return null;
  const [{ data: profile }, { data: blockRow }, { data: blockedMe }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_path, bio, last_seen_at, last_active_at, show_activity_status")
      .eq("id", otherId)
      .maybeSingle(),
    supabase.from("user_blocks").select("blocked_id").eq("blocker_id", user.id).eq("blocked_id", otherId).maybeSingle(),
    supabase.from("user_blocks").select("blocker_id").eq("blocker_id", otherId).eq("blocked_id", user.id).maybeSingle(),
  ]);
  const me = (rows ?? []).find((r) => r.user_id === user.id);
  const peer = (rows ?? []).find((r) => r.user_id !== user.id);
  return {
    profile: profile as ProfileLite | null,
    muted: Boolean(me?.muted),
    blockedByMe: Boolean(blockRow),
    blocked: Boolean(blockRow || blockedMe),
    peerLastReadAt: peer?.last_read_at ?? null,
  };
}

export async function listMessages(conversationId: string, cursor?: string | null): Promise<ThreadPage> {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  const peerState = await getConversationPeer(conversationId);
  if (!peerState) throw new Error("FORBIDDEN");

  let query = supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, kind, payload, created_at, deleted_at, edited_at, client_id, reply_to_message_id")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(PAGE + 1);
  if (cursor) query = query.lt("created_at", cursor);
  const { data } = await query;
  const page = (data ?? []).slice(0, PAGE);
  const nextCursor = (data ?? []).length > PAGE ? page[page.length - 1]?.created_at ?? null : null;
  const chronological = [...page].reverse();

  if (!cursor) {
    await supabase
      .from("conversation_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id);
  }

  const messages = await hydrateMessages(chronological, user.id);
  return {
    messages,
    nextCursor,
    typing: false,
    peerLastReadAt: peerState.peerLastReadAt,
    muted: peerState.muted,
    blocked: peerState.blocked,
    blockedByMe: peerState.blockedByMe,
  };
}

export async function hydrateMessages(
  rows: Array<{
    id: string;
    conversation_id: string;
    sender_id: string;
    body: string | null;
    kind: string;
    payload: unknown;
    created_at: string;
    deleted_at: string | null;
    edited_at?: string | null;
    client_id?: string | null;
    reply_to_message_id?: string | null;
  }>,
  viewerId: string,
): Promise<ChatMessage[]> {
  if (!rows.length) return [];
  const supabase = await createServerSupabase();
  const senderIds = [...new Set(rows.map((m) => m.sender_id))];
  const ids = rows.map((m) => m.id);
  const replyIds = rows.map((m) => m.reply_to_message_id).filter(Boolean) as string[];
  const postIds = rows.filter((m) => m.kind === "post").map((m) => String((m.payload as { postId?: string })?.postId ?? "")).filter(Boolean);
  const placeIds = rows
    .filter((m) => m.kind === "place" || m.kind === "invite")
    .map((m) => String((m.payload as { placeId?: string })?.placeId ?? ""))
    .filter(Boolean);
  const usernames = rows.filter((m) => m.kind === "profile").map((m) => String((m.payload as { username?: string })?.username ?? "")).filter(Boolean);

  const [{ data: senders }, { data: replies }, { data: reactions }, { data: posts }, { data: places }, { data: people }] =
    await Promise.all([
      supabase.from("profiles").select("id, username, display_name, avatar_path, bio, last_seen_at, last_active_at, show_activity_status").in("id", senderIds),
      replyIds.length
        ? supabase.from("messages").select("id, body, kind, sender_id, deleted_at").in("id", replyIds)
        : Promise.resolve({ data: [] as never[] }),
      supabase.from("message_reactions").select("message_id, user_id, reaction").in("message_id", ids),
      postIds.length
        ? supabase
            .from("experience_posts")
            .select("id, caption, verification_status, profiles!experience_posts_author_id_fkey(username, display_name, avatar_path), places!experience_posts_place_id_fkey(name), post_media(storage_path, sort_order)")
            .in("id", postIds)
        : Promise.resolve({ data: [] as never[] }),
      placeIds.length
        ? supabase
            .from("places")
            .select("id, slug, name, district, cover_image_path, place_categories(name_vi)")
            .in("id", placeIds)
        : Promise.resolve({ data: [] as never[] }),
      usernames.length
        ? supabase.from("profiles").select("id, username, display_name, avatar_path, bio").in("username", usernames)
        : Promise.resolve({ data: [] as never[] }),
    ]);

  const senderById = new Map((senders ?? []).map((p) => [p.id, p as ProfileLite]));
  const replyById = new Map((replies ?? []).map((r) => [r.id, r]));
  const postById = new Map((posts ?? []).map((p) => [p.id, p]));
  const placeById = new Map((places ?? []).map((p) => [p.id, p]));
  const peopleByUsername = new Map((people ?? []).map((p) => [p.username, p]));

  const moodByPlace = new Map<string, string>();
  const spendByPlace = new Map<string, string>();
  const verifiedPlaces = new Set<string>();
  if (placeIds.length) {
    const [{ data: moodRows }, { data: costRows }, { data: statRows }] = await Promise.all([
      supabase.from("place_moods").select("place_id, mood_id, weight").in("place_id", placeIds),
      supabase.from("place_cost_stats").select("place_id, median_spend_per_person").in("place_id", placeIds),
      supabase.from("place_experience_stats").select("place_id, verified_sample_count").in("place_id", placeIds),
    ]);
    const moodIds = [...new Set((moodRows ?? []).map((row) => row.mood_id))];
    const { data: moodDefs } = moodIds.length
      ? await supabase.from("moods").select("id, name_vi").in("id", moodIds)
      : { data: [] as Array<{ id: string; name_vi: string }> };
    const moodNameById = new Map((moodDefs ?? []).map((m) => [m.id, m.name_vi]));
    const bestMood = new Map<string, { weight: number; name: string }>();
    for (const row of moodRows ?? []) {
      const name = moodNameById.get(row.mood_id);
      if (!name) continue;
      const cur = bestMood.get(row.place_id);
      if (!cur || Number(row.weight) > cur.weight) bestMood.set(row.place_id, { weight: Number(row.weight), name });
    }
    for (const [id, value] of bestMood) moodByPlace.set(id, value.name);
    for (const row of costRows ?? []) {
      if (row.median_spend_per_person != null) {
        spendByPlace.set(row.place_id, formatSpendPerPerson(Number(row.median_spend_per_person)));
      }
    }
    for (const row of statRows ?? []) {
      if ((row.verified_sample_count ?? 0) > 0) verifiedPlaces.add(row.place_id);
    }
  }

  const reactionMap = new Map<string, Map<string, { count: number; mine: boolean }>>();
  for (const row of reactions ?? []) {
    const byMsg = reactionMap.get(row.message_id) ?? new Map();
    const cur = byMsg.get(row.reaction) ?? { count: 0, mine: false };
    cur.count += 1;
    if (row.user_id === viewerId) cur.mine = true;
    byMsg.set(row.reaction, cur);
    reactionMap.set(row.message_id, byMsg);
  }

  const imagePaths = rows.filter((m) => m.kind === "image" && !m.deleted_at).map((m) => String((m.payload as { storagePath?: string })?.storagePath ?? "")).filter(Boolean);
  const signed = new Map<string, string>();
  if (imagePaths.length) {
    const { data: signedRows } = await supabase.storage.from("message-media").createSignedUrls(imagePaths, 3600);
    for (const row of signedRows ?? []) {
      if (row.signedUrl && row.path) signed.set(row.path, row.signedUrl);
    }
  }

  return rows.map((msg) => {
    const payload = (msg.payload ?? {}) as Record<string, unknown>;
    const replyRow = msg.reply_to_message_id ? replyById.get(msg.reply_to_message_id) : null;
    const reactionsFor = [...(reactionMap.get(msg.id)?.entries() ?? [])].map(([reaction, v]) => ({
      reaction,
      count: v.count,
      mine: v.mine,
    }));
    const post = mapPost(postById.get(String(payload.postId ?? "")));
    const placeId = String(payload.placeId ?? "");
    const place = mapPlace(placeById.get(placeId), {
      moodName: moodByPlace.get(placeId) ?? null,
      spendLabel: spendByPlace.get(placeId) ?? null,
      verified: verifiedPlaces.has(placeId),
    });
    const profile = mapProfile(peopleByUsername.get(String(payload.username ?? "")));
    return {
      id: msg.id,
      conversation_id: msg.conversation_id,
      sender_id: msg.sender_id,
      body: msg.body,
      kind: (msg.kind as ChatKind) ?? "text",
      payload,
      created_at: msg.created_at,
      deleted_at: msg.deleted_at,
      edited_at: msg.edited_at ?? null,
      client_id: msg.client_id ?? null,
      reply_to_message_id: msg.reply_to_message_id ?? null,
      reply: replyRow
        ? {
            id: replyRow.id,
            body: replyRow.deleted_at ? "Tin nhắn đã được thu hồi." : replyRow.body,
            kind: replyRow.kind,
            senderName: senderById.get(replyRow.sender_id)?.display_name ?? null,
          }
        : null,
      sender: senderById.get(msg.sender_id) ?? null,
      reactions: reactionsFor,
      imageUrl: signed.get(String(payload.storagePath ?? "")) ?? null,
      post,
      place,
      profile,
      invite:
        msg.kind === "invite"
          ? {
              invitationId: payload.invitationId ? String(payload.invitationId) : null,
              status: (["pending", "accepted", "maybe", "declined"].includes(String(payload.status ?? "pending"))
                ? String(payload.status ?? "pending")
                : "pending") as InviteStatus,
              suggestedDate: payload.suggestedDate ? String(payload.suggestedDate) : null,
              suggestedTime: payload.suggestedTime ? String(payload.suggestedTime) : null,
              note: payload.note ? String(payload.note) : msg.body,
            }
          : null,
      status: "sent",
    };
  });
}

function mapPost(row: unknown): SharedPostPreview {
  if (!row || typeof row !== "object") return null;
  const p = row as {
    id: string;
    caption: string | null;
    verification_status: string;
    profiles: { username: string; display_name: string; avatar_path: string | null } | null;
    places: { name: string } | null;
    post_media: { storage_path: string; sort_order: number }[] | null;
  };
  const media = [...(p.post_media ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
  return {
    id: p.id,
    caption: p.caption,
    verificationStatus: p.verification_status,
    author: p.profiles ?? { username: "", display_name: "Người dùng", avatar_path: null },
    placeName: p.places?.name ?? null,
    thumbnail: media
      ? media.storage_path.startsWith("http")
        ? optimizedImageSrc(media.storage_path, 480)
        : mediaSrc(media.storage_path, "experience-media")
      : null,
  };
}

function mapPlace(
  row: unknown,
  extras?: { moodName: string | null; spendLabel: string | null; verified: boolean },
): SharedPlacePreview {
  if (!row || typeof row !== "object") return null;
  const p = row as {
    id: string;
    slug: string;
    name: string;
    district: string | null;
    cover_image_path: string | null;
    place_categories: { name_vi: string } | null;
  };
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    district: p.district,
    categoryName: p.place_categories?.name_vi ?? null,
    cover: optimizedImageSrc(p.cover_image_path, 640),
    moodName: extras?.moodName ?? null,
    spendLabel: extras?.spendLabel ?? null,
    verified: Boolean(extras?.verified),
  };
}

function mapProfile(row: unknown): SharedProfilePreview {
  if (!row || typeof row !== "object") return null;
  const p = row as { id: string; username: string; display_name: string; avatar_path: string | null; bio: string | null };
  return { ...p, followers: null };
}

export async function searchMessageablePeople(query: string) {
  const { user } = await requireUser();
  const q = query.trim().replace(/[%_,]/g, "").slice(0, 40);
  if (q.length < 2) return [] as ProfileLite[];
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_path, bio")
    .is("deleted_at", null)
    .not("role", "in", "(admin,moderator)")
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .limit(12);
  return ((data ?? []) as ProfileLite[]).filter((p) => p.id !== user.id && p.username !== "realidi");
}

export async function getAttachablePlaces() {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("places")
    .select("id, slug, name, district, cover_image_path, place_categories(name_vi)")
    .eq("status", "active")
    .order("name")
    .limit(40);
  return (data ?? []).map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    district: p.district,
    cover_image_path: p.cover_image_path,
    categoryName: (p as { place_categories: { name_vi: string } | null }).place_categories?.name_vi ?? null,
  }));
}

export async function getAttachablePosts() {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("experience_posts")
    .select("id, caption, places!experience_posts_place_id_fkey(name)")
    .eq("status", "published")
    .is("deleted_at", null)
    .eq("author_id", user.id)
    .order("published_at", { ascending: false })
    .limit(20);
  const items: Array<{ id: string; caption: string | null; placeName: string | null }> = [];
  const seen = new Set<string>();
  for (const row of data ?? []) {
    items.push({
      id: row.id,
      caption: row.caption,
      placeName: (row as { places: { name: string } | null }).places?.name ?? null,
    });
    seen.add(row.id);
  }
  const { data: saved } = await supabase.from("saved_posts").select("post_id").eq("user_id", user.id).limit(20);
  const savedIds = (saved ?? []).map((row) => row.post_id).filter((id) => !seen.has(id));
  if (savedIds.length) {
    const { data: savedPosts } = await supabase
      .from("experience_posts")
      .select("id, caption, places!experience_posts_place_id_fkey(name)")
      .in("id", savedIds);
    for (const post of savedPosts ?? []) {
      if (seen.has(post.id)) continue;
      items.push({
        id: post.id,
        caption: post.caption,
        placeName: (post as { places: { name: string } | null }).places?.name ?? null,
      });
    }
  }
  return items.slice(0, 24);
}

export async function getConversationShared(conversationId: string) {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  const { data: member } = await supabase
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) throw new Error("FORBIDDEN");
  const { data } = await supabase
    .from("messages")
    .select("id, kind, payload, created_at, deleted_at")
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .in("kind", ["image", "place", "post", "invite"])
    .order("created_at", { ascending: false })
    .limit(60);
  return hydrateMessages((data ?? []).map((m) => ({
    ...m,
    conversation_id: conversationId,
    sender_id: user.id,
    body: null,
    edited_at: null,
    client_id: null,
    reply_to_message_id: null,
  })), user.id);
}

export async function getHydratedMessage(id: string) {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, kind, payload, created_at, deleted_at, edited_at, client_id, reply_to_message_id")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const [msg] = await hydrateMessages([data], user.id);
  return msg ?? null;
}

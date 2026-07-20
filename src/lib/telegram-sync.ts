import { supabase } from "./supabase";
import type { TelegramWebAppUser } from "./telegram-types";

/**
 * Upsert the full Telegram user profile into the `telegram_users` table.
 *
 * Called once when the Mini App opens. Uses `ON CONFLICT (telegram_id)` so
 * the first visit creates a row and subsequent visits update it.
 */
export async function syncTelegramUser(user: TelegramWebAppUser) {
  const { error } = await supabase
    .from("telegram_users")
    .upsert(
      {
        telegram_id: user.id,
        first_name: user.first_name,
        last_name: user.last_name ?? null,
        username: user.username ?? null,
        language_code: user.language_code ?? null,
        is_bot: user.is_bot ?? false,
        is_premium: user.is_premium ?? false,
        added_to_attachment_menu: user.added_to_attachment_menu ?? false,
        allows_write_to_pm: user.allows_write_to_pm ?? true,
        photo_url: user.photo_url ?? null,
      },
      { onConflict: "telegram_id" }
    );

  if (error) {
    console.error("[syncTelegramUser] Failed to upsert user:", error.message);
  }
}

/**
 * Record that a user tapped the "Join Zoom" button.
 * Updates their `meeting_participants` status to `joined` and sets `joined_at`.
 */
export async function trackZoomJoin(telegramId: number, meetingId: string) {
  const { error } = await supabase
    .from("meeting_participants")
    .upsert(
      {
        meeting_id: meetingId,
        telegram_id: telegramId,
        status: "joined" as const,
        joined_at: new Date().toISOString(),
      },
      { onConflict: "meeting_id,telegram_id" }
    );

  if (error) {
    console.error("[trackZoomJoin] Failed to track join:", error.message);
  }
}

/**
 * Fetch contacts for a given user (people they've added).
 */
export async function getContacts(telegramId: number) {
  const { data, error } = await supabase
    .from("contacts")
    .select(
      `
      id,
      contact_telegram_id,
      nickname,
      created_at,
      contact:telegram_users!contacts_contact_telegram_id_fkey (
        telegram_id,
        first_name,
        last_name,
        username,
        photo_url
      )
    `
    )
    .eq("user_telegram_id", telegramId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getContacts] Failed to fetch:", error.message);
    return [];
  }

  return data ?? [];
}

/**
 * Add a contact by their telegram username.
 */
export async function addContact(
  userTelegramId: number,
  contactTelegramId: number,
  nickname?: string
) {
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      user_telegram_id: userTelegramId,
      contact_telegram_id: contactTelegramId,
      nickname: nickname ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("[addContact] Failed:", error.message);
    return null;
  }

  return data;
}

/**
 * Look up a Telegram user by username (for adding contacts).
 */
export async function findUserByUsername(username: string) {
  const { data, error } = await supabase
    .from("telegram_users")
    .select("telegram_id, first_name, last_name, username, photo_url")
    .eq("username", username.replace("@", ""))
    .single();

  if (error) {
    return null;
  }

  return data;
}

/**
 * Get or create a conversation of a specific type.
 * For direct/private 1:1 chats, checks if a conversation with these members already exists.
 * If not, it creates a conversation and adds the members.
 */
export async function getOrCreateConversation(
  type: "direct" | "meeting_central" | "meeting_private",
  members: number[], // list of telegram_ids
  meetingId?: string | null,
  title?: string | null
) {
  // If it's central, query by meeting_id & type
  if (type === "meeting_central" && meetingId) {
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("type", type)
      .eq("meeting_id", meetingId)
      .maybeSingle();

    if (existing) return existing.id;

    const { data: created, error } = await supabase
      .from("conversations")
      .insert({ type, meeting_id: meetingId, title: title ?? "Meeting Chat" })
      .select("id")
      .single();

    if (error || !created) return null;
    return created.id;
  }

  // For 1:1 chats (direct/meeting_private), check if they share a conversation
  // Query conversations of this type where both members are present
  const { data: shared } = await supabase
    .rpc("get_shared_conversation", {
      p_type: type,
      p_user1: members[0],
      p_user2: members[1],
      p_meeting_id: meetingId ?? null
    });

  if (shared && shared.length > 0) {
    return shared[0].conversation_id;
  }

  // Create new conversation
  const { data: conv, error: convErr } = await supabase
    .from("conversations")
    .insert({ type, meeting_id: meetingId ?? null, title: title ?? null })
    .select("id")
    .single();

  if (convErr || !conv) return null;

  // Add members
  const memberInserts = members.map((mId) => ({
    conversation_id: conv.id,
    telegram_id: mId
  }));

  const { error: memErr } = await supabase
    .from("conversation_members")
    .insert(memberInserts);

  if (memErr) {
    console.error("[getOrCreateConversation] Member link failed:", memErr.message);
  }

  return conv.id;
}

/**
 * Send a chat message.
 */
export async function sendMessage(conversationId: string, senderId: number, content: string) {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_telegram_id: senderId,
      content
    })
    .select()
    .single();

  if (error) {
    console.error("[sendMessage] Failed to send:", error.message);
    return null;
  }

  return data;
}

/**
 * Get message history for a conversation.
 */
export async function getMessages(conversationId: string) {
  const { data, error } = await supabase
    .from("messages")
    .select(`
      id,
      content,
      created_at,
      sender_telegram_id,
      sender:telegram_users!messages_sender_telegram_id_fkey (
        first_name,
        last_name,
        username,
        photo_url
      )
    `)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[getMessages] Failed to load:", error.message);
    return [];
  }

  return data ?? [];
}

/**
 * Fetch other approved/joined/attended participants for a meeting.
 */
export async function getMeetingParticipants(meetingId: string, excludeTelegramId?: number) {
  let query = supabase
    .from("meeting_participants")
    .select(`
      id,
      status,
      telegram_id,
      user:telegram_users!meeting_participants_telegram_id_fkey (
        first_name,
        last_name,
        username,
        photo_url
      )
    `)
    .eq("meeting_id", meetingId)
    .in("status", ["approved", "joined", "attended"]);

  if (excludeTelegramId) {
    query = query.neq("telegram_id", excludeTelegramId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[getMeetingParticipants] Failed to fetch:", error.message);
    return [];
  }

  return data ?? [];
}

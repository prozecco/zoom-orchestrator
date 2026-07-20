import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getMessages, sendMessage } from "@/lib/telegram-sync";

export type ChatMessageItem = {
  id: string;
  content: string;
  created_at: string;
  sender_telegram_id: number;
  media_url?: string | null;
  media_type?: string | null; // 'image' | 'video' | 'file'
  is_view_once?: boolean;
  view_once_seen?: boolean;
  expires_at?: string | null;
  sender: {
    first_name: string;
    last_name: string | null;
    username: string | null;
    photo_url: string | null;
  };
};

/**
 * Hook for managing live chat.
 * Automatically handles Supabase Realtime subscriptions if configured.
 * Otherwise, falls back to a simulated real-time experience for local testing.
 * Also manages local client-side timers for self-destructing and view-once media.
 */
export function useLiveChat(conversationId: string | null, currentUserTelegramId: number) {
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

  const isMockMode = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes("placeholder");

  // Load message history
  const loadHistory = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    setLoading(true);

    if (isMockMode) {
      setTimeout(() => {
        const mockHistories: Record<string, ChatMessageItem[]> = {
          "meeting-central": [
            {
              id: "h1",
              content: "Welcome everyone! The weekly sync has started.",
              created_at: new Date(Date.now() - 3600000).toISOString(),
              sender_telegram_id: 9999, // host
              sender: { first_name: "Elena", last_name: "Ross", username: "elenaross", photo_url: null }
            },
            {
              id: "h2",
              content: "Audio and video are running smooth.",
              created_at: new Date(Date.now() - 3000000).toISOString(),
              sender_telegram_id: 1111,
              sender: { first_name: "Bruno", last_name: "Silva", username: "brunos", photo_url: null }
            }
          ]
        };
        setMessages(mockHistories[conversationId] || []);
        setLoading(false);
      }, 300);
      return;
    }

    const data = await getMessages(conversationId);
    setMessages(data as any as ChatMessageItem[]);
    setLoading(false);
  }, [conversationId, isMockMode]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Handle sending a message (supports media sending)
  const send = useCallback(async (
    content: string, 
    senderName: string, 
    media?: { url: string; type: string; isViewOnce?: boolean; expiresSeconds?: number }
  ) => {
    if (!conversationId) return;

    let expiresAt: string | null = null;
    if (media?.expiresSeconds) {
      expiresAt = new Date(Date.now() + media.expiresSeconds * 1000).toISOString();
    }

    if (isMockMode) {
      const newMsg: ChatMessageItem = {
        id: `mock-${Date.now()}`,
        content,
        created_at: new Date().toISOString(),
        sender_telegram_id: currentUserTelegramId,
        media_url: media?.url ?? null,
        media_type: media?.type ?? null,
        is_view_once: media?.isViewOnce ?? false,
        view_once_seen: false,
        expires_at: expiresAt,
        sender: { first_name: senderName, last_name: null, username: null, photo_url: null }
      };

      setMessages((prev) => [...prev, newMsg]);

      // Simulate a mock response after 2 seconds
      setTimeout(() => {
        if (conversationIdRef.current !== conversationId) return;
        
        let replyText = "Nice file! Here's a reply from me.";
        let senderNameReply = "Bruno";
        let senderIdReply = 1111;

        if (conversationId === "meeting-central") {
          replyText = "Let's keep the focus on the main screen.";
          senderNameReply = "Elena";
          senderIdReply = 9999;
        }

        const replyMsg: ChatMessageItem = {
          id: `reply-${Date.now()}`,
          content: replyText,
          created_at: new Date().toISOString(),
          sender_telegram_id: senderIdReply,
          sender: { first_name: senderNameReply, last_name: null, username: null, photo_url: null }
        };
        setMessages((prev) => [...prev, replyMsg]);
      }, 2000);

      return;
    }

    // Supabase Mode
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_telegram_id: currentUserTelegramId,
      content,
      media_url: media?.url ?? null,
      media_type: media?.type ?? null,
      is_view_once: media?.isViewOnce ?? false,
      expires_at: expiresAt
    });
  }, [conversationId, currentUserTelegramId, isMockMode]);

  // Set view once opened/seen
  const setSeen = useCallback(async (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, view_once_seen: true } : m))
    );

    if (!isMockMode) {
      await supabase
        .from("messages")
        .update({ view_once_seen: true })
        .eq("id", messageId);
    }
  }, [isMockMode]);

  // Clean up expired disappearing messages locally in realtime
  useEffect(() => {
    const timer = setInterval(() => {
      setMessages((prev) =>
        prev.filter((m) => {
          if (!m.expires_at) return true;
          return new Date(m.expires_at) > new Date();
        })
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Supabase Realtime subscription
  useEffect(() => {
    if (isMockMode || !conversationId) return;

    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`
        },
        async (payload) => {
          const { data: sender } = await supabase
            .from("telegram_users")
            .select("first_name, last_name, username, photo_url")
            .eq("telegram_id", payload.new.sender_telegram_id)
            .single();

          const newMsg: ChatMessageItem = {
            id: payload.new.id,
            content: payload.new.content,
            created_at: payload.new.created_at,
            sender_telegram_id: payload.new.sender_telegram_id,
            media_url: payload.new.media_url,
            media_type: payload.new.media_type,
            is_view_once: payload.new.is_view_once,
            view_once_seen: payload.new.view_once_seen,
            expires_at: payload.new.expires_at,
            sender: sender || { first_name: "Anonymous", last_name: null, username: null, photo_url: null }
          };

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          // Listen for view_once_seen updates
          setMessages((prev) =>
            prev.map((m) =>
              m.id === payload.new.id ? { ...m, view_once_seen: payload.new.view_once_seen } : m
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, isMockMode]);

  return { messages, loading, send, setSeen };
}

import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listCentralMessages, listThreadMessages, sendChatMessage } from "@/lib/messages.functions";

export type ChatMsg = {
  id: string;
  meeting_id: string | null;
  registrant_id: string | null;
  from_role: string;
  from_name: string;
  text: string;
  created_at: string;
};

/**
 * Live chat for a meeting.
 * - conversation = { meetingId, registrantId? }  (null registrantId => central room)
 * - Subscribes to public.messages via realtime, scoped to the meeting.
 */
export function useMeetingChat(
  meetingId: string | null,
  registrantId: string | null,
  sender: { fromRole: "host" | "attendee"; fromName: string; actorTelegramId?: number | null },
) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const loadCentral = useServerFn(listCentralMessages);
  const loadThread = useServerFn(listThreadMessages);
  const doSend = useServerFn(sendChatMessage);

  const refetch = useCallback(async () => {
    if (!meetingId) { setMessages([]); return; }
    setLoading(true);
    try {
      const rows = registrantId
        ? await loadThread({ data: { registrantId } })
        : await loadCentral({ data: { meetingId } });
      setMessages((rows as ChatMsg[]) ?? []);
    } catch (e) {
      console.error("[useMeetingChat] load failed", e);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [meetingId, registrantId, loadCentral, loadThread]);

  useEffect(() => { refetch(); }, [refetch]);

  useEffect(() => {
    if (!meetingId) return;
    const channel = supabase
      .channel(`meeting-${meetingId}-${registrantId ?? "central"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `meeting_id=eq.${meetingId}` },
        (payload) => {
          const row = payload.new as ChatMsg;
          const matches = registrantId ? row.registrant_id === registrantId : row.registrant_id === null;
          if (!matches) return;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [meetingId, registrantId]);

  const send = useCallback(async (text: string) => {
    if (!meetingId || !text.trim()) return;
    await doSend({
      data: {
        meetingId,
        registrantId: registrantId ?? null,
        text: text.trim(),
        fromRole: sender.fromRole,
        fromName: sender.fromName,
        actorTelegramId: sender.actorTelegramId ?? null,
      },
    });
  }, [meetingId, registrantId, sender.fromRole, sender.fromName, sender.actorTelegramId, doSend]);

  return { messages, loading, send, refetch };
}

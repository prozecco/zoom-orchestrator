import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isAdminId } from "./admin-config";

// Real chat backed by public.messages
// (columns: meeting_id, registrant_id, from_role, from_name, text, telegram_message_id, created_at)
// Central room = messages where registrant_id IS NULL.
// 1:1 = messages with a specific registrant_id.

const MeetingInput = z.object({ meetingId: z.string().uuid() });

export const listCentralMessages = createServerFn({ method: "GET" })
  .inputValidator((raw) => MeetingInput.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("messages")
      .select("*")
      .eq("meeting_id", data.meetingId)
      .is("registrant_id", null)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const RegistrantInput = z.object({ registrantId: z.string().uuid() });

export const listThreadMessages = createServerFn({ method: "GET" })
  .inputValidator((raw) => RegistrantInput.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("messages")
      .select("*")
      .eq("registrant_id", data.registrantId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listApprovedRegistrants = createServerFn({ method: "GET" })
  .inputValidator((raw) => MeetingInput.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("registrants")
      .select("id, name, telegram_user, telegram_id, email, status")
      .eq("meeting_id", data.meetingId)
      .in("status", ["approved", "attended"])
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const SendInput = z.object({
  meetingId: z.string().uuid(),
  registrantId: z.string().uuid().nullable().optional(),
  text: z.string().min(1).max(2000),
  fromRole: z.enum(["host", "attendee"]),
  fromName: z.string().min(1).max(120),
  actorTelegramId: z.number().nullable().optional(),
});

export const sendChatMessage = createServerFn({ method: "POST" })
  .inputValidator((raw) => SendInput.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendTelegramMessage } = await import("./telegram.server");

    if (data.fromRole === "host" && !isAdminId(data.actorTelegramId ?? undefined)) {
      throw new Error("Not authorized");
    }

    let telegramMessageId: number | null = null;

    // 1:1 → forward to the registrant's telegram if we have it.
    if (data.registrantId && data.fromRole === "host") {
      const { data: reg } = await supabaseAdmin
        .from("registrants")
        .select("telegram_id")
        .eq("id", data.registrantId)
        .maybeSingle();
      if (reg?.telegram_id) {
        try {
          const res = await sendTelegramMessage(reg.telegram_id, `💬 Host: ${data.text}`);
          telegramMessageId = res?.message_id ?? null;
        } catch (e) { console.error("host->tg failed", e); }
      }
    } else if (data.registrantId && data.fromRole === "attendee") {
      const notify = process.env.NOTIFICATION_CHAT_ID;
      if (notify) {
        try {
          const res = await sendTelegramMessage(notify, `💬 ${data.fromName}: ${data.text}`);
          telegramMessageId = res?.message_id ?? null;
        } catch (e) { console.error("attendee->tg failed", e); }
      }
    }

    const { data: saved, error } = await supabaseAdmin
      .from("messages")
      .insert({
        meeting_id: data.meetingId,
        registrant_id: data.registrantId ?? null,
        from_role: data.fromRole,
        from_name: data.fromName,
        text: data.text,
        telegram_message_id: telegramMessageId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return saved;
  });

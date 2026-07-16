import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isAdminId } from "./admin-config";

const ThreadInput = z.object({ registrantId: z.string().uuid() });

export const listThreadMessages = createServerFn({ method: "GET" })
  .inputValidator((raw) => ThreadInput.parse(raw))
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

const SendInput = z.object({
  registrantId: z.string().uuid(),
  text: z.string().min(1).max(2000),
  fromRole: z.enum(["host", "attendee"]),
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

    const { data: reg, error: rErr } = await supabaseAdmin
      .from("registrants")
      .select("id, meeting_id, telegram_id, name")
      .eq("id", data.registrantId)
      .single();
    if (rErr) throw new Error(rErr.message);

    const fromName = data.fromRole === "host" ? "Host" : reg.name;

    // Push to Telegram (best-effort).
    let telegramMessageId: number | null = null;
    if (data.fromRole === "host" && reg.telegram_id) {
      try {
        const res = await sendTelegramMessage(reg.telegram_id, `💬 Host: ${data.text}`);
        telegramMessageId = res?.message_id ?? null;
      } catch (e) { console.error("host->tg failed", e); }
    } else if (data.fromRole === "attendee") {
      const notify = process.env.NOTIFICATION_CHAT_ID;
      if (notify) {
        try {
          const res = await sendTelegramMessage(notify, `💬 ${reg.name}: ${data.text}`);
          telegramMessageId = res?.message_id ?? null;
        } catch (e) { console.error("attendee->tg failed", e); }
      }
    }

    const { data: saved, error } = await supabaseAdmin
      .from("messages")
      .insert({
        meeting_id: reg.meeting_id,
        registrant_id: reg.id,
        from_role: data.fromRole,
        from_name: fromName,
        text: data.text,
        telegram_message_id: telegramMessageId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return saved;
  });

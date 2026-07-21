import { createFileRoute } from "@tanstack/react-router";

// Telegram Bot webhook. Public endpoint (bypasses Lovable auth) — auth comes
// from the X-Telegram-Bot-Api-Secret-Token header, verified against a value
// derived from TELEGRAM_API_KEY (stable, server-only).

const PROJECT_ID = "cbe070bb-701e-43f7-a232-28b0f775ce66";
const MINI_APP_URL = `https://project--${PROJECT_ID}-dev.lovable.app`;

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { deriveTelegramWebhookSecret, sendTelegramMessage } = await import("@/lib/telegram.server");
        const { isAdminId } = await import("@/lib/admin-config");

        const expected = await deriveTelegramWebhookSecret();
        const provided = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(provided, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const update = await request.json().catch(() => null) as any;
        const message = update?.message ?? update?.edited_message;
        if (!message?.chat?.id) return Response.json({ ok: true, ignored: true });

        const chatId = message.chat.id as number;
        const fromId = message.from?.id as number | undefined;
        const text: string = message.text ?? "";
        const isAdmin = isAdminId(fromId);

        try {
          if (text.startsWith("/start")) {
            const url = isAdmin ? `${MINI_APP_URL}/admin` : `${MINI_APP_URL}/app`;
            const label = isAdmin ? "Open Admin Dashboard" : "Register for meeting";
            await sendTelegramMessage(
              chatId,
              isAdmin
                ? "Welcome, admin. Open the dashboard to manage meetings, registrants, and live chat."
                : "Welcome! Tap below to register for the active meeting.",
              {
                reply_markup: {
                  inline_keyboard: [[{ text: label, web_app: { url } }]],
                },
              },
            );
          } else if (text.startsWith("/help")) {
            const lines = isAdmin
              ? ["Admin commands:", "/start — open dashboard", "/active — show active meeting", "/setmeeting <zoom_id> — switch active meeting"]
              : ["Available:", "/start — open the Mini App", "/help — this message"];
            await sendTelegramMessage(chatId, lines.join("\n"));
          } else if (text.startsWith("/active")) {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data } = await supabaseAdmin.from("meetings").select("*").eq("is_active", true).maybeSingle();
            if (!data) await sendTelegramMessage(chatId, "No active meeting configured.");
            else await sendTelegramMessage(chatId,
              `Active meeting: ${data.topic}\nZoom ID: ${data.zoom_id}\nStart: ${data.start_time ?? "—"}\nJoin: ${data.join_url ?? "—"}`);
          } else if (isAdmin && text.startsWith("/setmeeting")) {
            const id = text.split(/\s+/)[1];
            if (!id) {
              await sendTelegramMessage(chatId, "Usage: /setmeeting <zoom_meeting_id>");
            } else {
              const { syncActiveMeeting } = await import("@/lib/meetings.functions");
              await syncActiveMeeting({ data: { meetingId: id, actorTelegramId: fromId ?? null } });
              await sendTelegramMessage(chatId, `Active meeting updated to ${id}.`);
            }
          } else if (text && fromId) {
            // Free-form message: route into a 1:1 thread if this user is a registrant.
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data: reg } = await supabaseAdmin
              .from("registrants")
              .select("id, meeting_id, name")
              .eq("telegram_id", fromId)
              .order("registered_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (reg) {
              await supabaseAdmin.from("registrant_messages").insert({
                meeting_id: reg.meeting_id,
                registrant_id: reg.id,
                from_role: "attendee",
                from_name: reg.name,
                text,
                telegram_message_id: message.message_id,
              } as never);
            } else {
              await sendTelegramMessage(chatId, "Send /start to open the Mini App.");
            }
          }
        } catch (e) {
          console.error("webhook handler error", e);
        }

        return Response.json({ ok: true });
      },
    },
  },
});

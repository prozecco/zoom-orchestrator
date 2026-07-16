import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isAdminId } from "./admin-config";

// Resolves the viewer's role from a Telegram id (supplied by the Mini App via
// window.Telegram.WebApp.initDataUnsafe). We currently trust the id because we
// don't have the raw bot token; if the app is opened outside Telegram it just
// returns { role: "guest" }. Wire HMAC verification once the bot token is
// available server-side.
const ResolveInput = z.object({
  telegramId: z.number().nullable().optional(),
});

export const resolveViewer = createServerFn({ method: "POST" })
  .inputValidator((raw) => ResolveInput.parse(raw))
  .handler(async ({ data }) => {
    const id = data.telegramId ?? null;
    if (id && isAdminId(id)) return { role: "admin" as const, telegramId: id };
    if (id) return { role: "attendee" as const, telegramId: id };
    return { role: "guest" as const, telegramId: null };
  });

const BroadcastInput = z.object({
  text: z.string().min(1).max(4000),
  actorTelegramId: z.number(),
});

export const broadcastToApproved = createServerFn({ method: "POST" })
  .inputValidator((raw) => BroadcastInput.parse(raw))
  .handler(async ({ data }) => {
    if (!isAdminId(data.actorTelegramId)) throw new Error("Not authorized");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendTelegramMessage } = await import("./telegram.server");
    const { data: rows, error } = await supabaseAdmin
      .from("registrants")
      .select("telegram_id, name")
      .in("status", ["approved", "attended"])
      .not("telegram_id", "is", null);
    if (error) throw new Error(error.message);

    let sent = 0;
    for (const r of rows ?? []) {
      try {
        await sendTelegramMessage(r.telegram_id!, data.text);
        sent++;
      } catch (e) { console.error("broadcast failed for", r.name, e); }
    }
    await supabaseAdmin.from("audit_log").insert({
      actor: `tg:${data.actorTelegramId}`,
      action: "Broadcast sent",
      target: `${sent} recipients`,
    });
    return { sent, total: rows?.length ?? 0 };
  });

export const listAudit = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("audit_log").select("*").order("at", { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getStats = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ count: meetingsCount }, { count: pendingCount }, { count: registrantsWeek }, { data: activeMeeting }] = await Promise.all([
    supabaseAdmin.from("meetings").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("registrants").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabaseAdmin.from("registrants").select("*", { count: "exact", head: true })
      .gte("registered_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()),
    supabaseAdmin.from("meetings").select("*").eq("is_active", true).maybeSingle(),
  ]);
  return {
    totalMeetings: meetingsCount ?? 0,
    pending: pendingCount ?? 0,
    registrantsThisWeek: registrantsWeek ?? 0,
    liveNow: activeMeeting ? 1 : 0,
  };
});

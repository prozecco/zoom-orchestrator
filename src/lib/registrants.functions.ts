import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isAdminId } from "./admin-config";

export const listRegistrants = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("registrants")
    .select("*")
    .order("registered_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

const ByTgInput = z.object({ telegramId: z.number() });

export const getMyRegistration = createServerFn({ method: "GET" })
  .inputValidator((raw) => ByTgInput.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("registrants")
      .select("*, meetings(*)")
      .eq("telegram_id", data.telegramId)
      .order("registered_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    return rows?.[0] ?? null;
  });

const SubmitInput = z.object({
  name: z.string().min(1).max(120),
  telegramUser: z.string().min(1).max(64),
  email: z.string().email(),
  phone: z.string().min(3).max(40),
  telegramId: z.number().nullable().optional(),
});

export const submitRegistration = createServerFn({ method: "POST" })
  .inputValidator((raw) => SubmitInput.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendTelegramMessage } = await import("./telegram.server");

    const { data: meeting, error: mErr } = await supabaseAdmin
      .from("meetings").select("id, topic").eq("is_active", true).maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!meeting) throw new Error("No active meeting is configured");

    const { data: saved, error } = await supabaseAdmin
      .from("registrants")
      .insert({
        meeting_id: meeting.id,
        telegram_id: data.telegramId ?? null,
        telegram_user: data.telegramUser,
        name: data.name,
        email: data.email,
        phone: data.phone,
        status: "pending",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_log").insert({
      actor: data.telegramId ? `tg:${data.telegramId}` : "web",
      action: "Submitted registration",
      target: data.name,
    });

    const notify = process.env.NOTIFICATION_CHAT_ID;
    if (notify) {
      try {
        await sendTelegramMessage(notify,
          `New registration for "${meeting.topic}"\n${data.name} (${data.telegramUser})\n${data.email} · ${data.phone}`);
      } catch (e) { console.error("notify failed", e); }
    }

    return saved;
  });

const UpdateStatusInput = z.object({
  registrantId: z.string().uuid(),
  status: z.enum(["pending", "approved", "rejected", "attended"]),
  actorTelegramId: z.number(),
});

export const updateRegistrantStatus = createServerFn({ method: "POST" })
  .inputValidator((raw) => UpdateStatusInput.parse(raw))
  .handler(async ({ data }) => {
    if (!isAdminId(data.actorTelegramId)) throw new Error("Not authorized");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendTelegramMessage } = await import("./telegram.server");

    const { data: saved, error } = await supabaseAdmin
      .from("registrants")
      .update({ status: data.status })
      .eq("id", data.registrantId)
      .select("*, meetings(topic, join_url, passcode)")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_log").insert({
      actor: `tg:${data.actorTelegramId}`,
      action: `Set registrant status to ${data.status}`,
      target: saved.name,
    });

    // Notify attendee on Telegram if we know their id.
    if (saved.telegram_id) {
      try {
        const m = (saved as any).meetings ?? {};
        if (data.status === "approved") {
          const parts = [`✅ You're approved for "${m.topic ?? "the meeting"}".`];
          if (m.join_url) parts.push(`Join: ${m.join_url}`);
          if (m.passcode) parts.push(`Passcode: ${m.passcode}`);
          await sendTelegramMessage(saved.telegram_id, parts.join("\n"));
        } else if (data.status === "rejected") {
          await sendTelegramMessage(saved.telegram_id,
            `Your registration for "${m.topic ?? "the meeting"}" was not approved.`);
        }
      } catch (e) { console.error("attendee notify failed", e); }
    }

    return saved;
  });

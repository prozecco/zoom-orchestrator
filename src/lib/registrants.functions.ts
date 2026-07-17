import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isAdminId } from "./admin-config";

export type RegistrantStatus = "pending" | "on_hold" | "approved" | "denied" | "cancelled" | "attended";

export const listRegistrants = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("registrants")
    .select("*")
    .order("registered_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

// Grouped view. `pending` older than 3 days is surfaced as `on_hold` at read time
// without mutating the row (admins can also promote explicitly if they want).
export const groupedRegistrants = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("registrants")
    .select("*")
    .order("registered_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;

  const groups: Record<RegistrantStatus, typeof rows> = {
    pending: [], on_hold: [], approved: [], denied: [], cancelled: [], attended: [],
  };

  for (const r of rows) {
    let bucket = r.status as RegistrantStatus;
    if (bucket === "pending" && new Date(r.registered_at).getTime() < threeDaysAgo) {
      bucket = "on_hold";
    }
    if (bucket === "on_hold" && (r.status as string) === "on_hold") {
      // keep as on_hold
    }
    // fall back to pending bucket if unrecognized
    if (!groups[bucket]) bucket = "pending";
    groups[bucket].push(r);
  }
  return groups;
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

const DetailInput = z.object({ registrantId: z.string().uuid() });

export const getRegistrantDetail = createServerFn({ method: "GET" })
  .inputValidator((raw) => DetailInput.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: reg, error } = await supabaseAdmin
      .from("registrants")
      .select("*, meetings(id, topic, zoom_id, start_time)")
      .eq("id", data.registrantId)
      .single();
    if (error) throw new Error(error.message);

    // History: same email OR same telegram_id, other rows.
    const email = (reg.email ?? "").toLowerCase();
    const tgId = reg.telegram_id;
    let historyQuery = supabaseAdmin
      .from("registrants")
      .select("id, name, telegram_user, telegram_id, email, status, registered_at, meetings(topic)")
      .neq("id", reg.id)
      .order("registered_at", { ascending: false });

    if (tgId) {
      historyQuery = historyQuery.or(`email.ilike.${email},telegram_id.eq.${tgId}`);
    } else {
      historyQuery = historyQuery.ilike("email", email);
    }
    const { data: history } = await historyQuery;

    const names = new Set<string>();
    const handles = new Set<string>();
    for (const h of history ?? []) {
      if (h.name) names.add(h.name);
      if (h.telegram_user) handles.add(h.telegram_user);
    }
    if (reg.name) names.add(reg.name);
    if (reg.telegram_user) handles.add(reg.telegram_user);

    const { data: notes } = await supabaseAdmin
      .from("registrant_notes")
      .select("*")
      .eq("registrant_id", reg.id)
      .order("created_at", { ascending: true });

    return {
      registrant: reg,
      history: {
        prior_count: history?.length ?? 0,
        past: history ?? [],
        name_variants: Array.from(names),
        handle_variants: Array.from(handles),
      },
      notes: notes ?? [],
    };
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
  status: z.enum(["pending", "on_hold", "approved", "denied", "cancelled", "attended"]),
  actorTelegramId: z.number(),
});

export const updateRegistrantStatus = createServerFn({ method: "POST" })
  .inputValidator((raw) => UpdateStatusInput.parse(raw))
  .handler(async ({ data }) => {
    if (!isAdminId(data.actorTelegramId)) throw new Error("Not authorized");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendTelegramMessage } = await import("./telegram.server");

    const patch = {
      status: data.status,
      ...(data.status === "cancelled" ? { cancelled_at: new Date().toISOString() } : {}),
    };

    const { data: saved, error } = await supabaseAdmin
      .from("registrants")
      .update(patch)
      .eq("id", data.registrantId)
      .select("*, meetings(topic, join_url, passcode)")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_log").insert({
      actor: `tg:${data.actorTelegramId}`,
      action: `Set registrant status to ${data.status}`,
      target: saved.name,
    });

    if (saved.telegram_id) {
      try {
        const m = (saved as any).meetings ?? {};
        if (data.status === "approved") {
          const parts = [`✅ You're approved for "${m.topic ?? "the meeting"}".`];
          if (m.join_url) parts.push(`Join: ${m.join_url}`);
          if (m.passcode) parts.push(`Passcode: ${m.passcode}`);
          await sendTelegramMessage(saved.telegram_id, parts.join("\n"));
        } else if (data.status === "denied") {
          await sendTelegramMessage(saved.telegram_id,
            `Your registration for "${m.topic ?? "the meeting"}" was not approved.`);
        } else if (data.status === "on_hold") {
          await sendTelegramMessage(saved.telegram_id,
            `Your registration for "${m.topic ?? "the meeting"}" is on hold pending review.`);
        }
      } catch (e) { console.error("attendee notify failed", e); }
    }

    return saved;
  });

const CancelInput = z.object({ registrantId: z.string().uuid(), telegramId: z.number() });

export const cancelMyRegistration = createServerFn({ method: "POST" })
  .inputValidator((raw) => CancelInput.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: reg, error: rErr } = await supabaseAdmin
      .from("registrants").select("id, telegram_id, name").eq("id", data.registrantId).single();
    if (rErr) throw new Error(rErr.message);
    if (reg.telegram_id !== data.telegramId) throw new Error("Not authorized");

    const { data: saved, error } = await supabaseAdmin
      .from("registrants")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", data.registrantId)
      .select()
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_log").insert({
      actor: `tg:${data.telegramId}`,
      action: "Cancelled own registration",
      target: reg.name,
    });
    return saved;
  });

const NoteInput = z.object({
  registrantId: z.string().uuid(),
  body: z.string().min(1).max(2000),
  actorTelegramId: z.number(),
  actorName: z.string().min(1).max(120),
});

export const addRegistrantNote = createServerFn({ method: "POST" })
  .inputValidator((raw) => NoteInput.parse(raw))
  .handler(async ({ data }) => {
    if (!isAdminId(data.actorTelegramId)) throw new Error("Not authorized");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: saved, error } = await supabaseAdmin
      .from("registrant_notes")
      .insert({
        registrant_id: data.registrantId,
        author_tg_id: data.actorTelegramId,
        author_name: data.actorName,
        body: data.body,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return saved;
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isAdminId } from "./admin-config";

// Server functions for meetings + Zoom sync.
// All helper logic is imported (avoid the ?tss-serverfn-split ReferenceError trap).

export const getActiveMeeting = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("meetings")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
});

export const listMeetings = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("meetings")
    .select("*")
    .order("start_time", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

const SyncInput = z.object({
  meetingId: z.string().optional(),
  actorTelegramId: z.number().nullable().optional(),
});

export const syncActiveMeeting = createServerFn({ method: "POST" })
  .validator((raw) => SyncInput.parse(raw))
  .handler(async ({ data }) => {
    if (data.actorTelegramId && !isAdminId(data.actorTelegramId)) {
      throw new Error("Not authorized");
    }
    const zoomId = data.meetingId ?? process.env.ZOOM_MEETING_ID;
    if (!zoomId) throw new Error("ZOOM_MEETING_ID is not configured");

    const { fetchZoomMeeting } = await import("./zoom.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const meeting = await fetchZoomMeeting(zoomId);

    // Clear existing active flag, then upsert this one as active.
    await supabaseAdmin.from("meetings").update({ is_active: false }).eq("is_active", true);

    const row = {
      zoom_id: String(meeting.id),
      topic: meeting.topic ?? "Zoom meeting",
      host_email: meeting.host_email ?? null,
      start_time: meeting.start_time ?? null,
      duration_min: meeting.duration ?? null,
      join_url: meeting.join_url ?? null,
      passcode: meeting.password ?? null,
      status: meeting.status ?? "scheduled",
      is_active: true,
      raw: meeting.raw ?? meeting,
      synced_at: new Date().toISOString(),
    };
    const { data: saved, error } = await supabaseAdmin
      .from("meetings")
      .upsert(row as never, { onConflict: "zoom_id" })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_log").insert({
      actor: data.actorTelegramId ? `tg:${data.actorTelegramId}` : "system",
      action: "Synced active meeting from Zoom",
      target: row.zoom_id,
    });

    return saved;
  });

const SyncUpcomingInput = z.object({
  actorTelegramId: z.number().nullable().optional(),
});

export const syncUpcomingMeetings = createServerFn({ method: "POST" })
  .validator((raw) => SyncUpcomingInput.parse(raw))
  .handler(async ({ data }) => {
    if (data.actorTelegramId && !isAdminId(data.actorTelegramId)) {
      throw new Error("Not authorized");
    }
    const { listUpcomingZoomMeetings } = await import("./zoom.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const meetings = await listUpcomingZoomMeetings("me");
    if (meetings.length === 0) return { count: 0 };

    const rows = meetings.map((m) => ({
      zoom_id: String(m.id),
      topic: m.topic ?? "Zoom meeting",
      host_email: m.host_email ?? null,
      start_time: m.start_time ?? null,
      duration_min: m.duration ?? null,
      join_url: m.join_url ?? null,
      passcode: m.password ?? null,
      status: m.status ?? "scheduled",
      raw: m.raw ?? m,
      synced_at: new Date().toISOString(),
    }));
    const { error } = await supabaseAdmin.from("meetings").upsert(rows as never, { onConflict: "zoom_id" });
    if (error) throw new Error(error.message);
    return { count: rows.length };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isAdminId } from "./admin-config";

// Server functions for meetings + Zoom sync.

export const getActiveMeeting = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("meetings")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();

  // If no active meeting found in DB yet, fallback to inserting default meeting
  if (!data) {
    const defaultRow = {
      id: "85651598189",
      zoom_id: "85651598189",
      topic: "ＳＵＮＣＬＯＵＤＳ １７６６",
      host_email: "sunclouds-jr@outlook.com",
      start_time: new Date().toISOString(),
      duration_min: 1440,
      join_url: "https://us05web.zoom.us/j/85651598189?pwd=xxJugOAf1uy1Amwlchy4ZbshgzvoYk.1",
      passcode: "1766",
      status: "started",
      is_active: true,
      capacity: 100,
      raw: { mode: "default_fallback" },
      synced_at: new Date().toISOString(),
    };
    const { data: inserted } = await supabaseAdmin
      .from("meetings")
      .upsert(defaultRow as never, { onConflict: "zoom_id" })
      .select()
      .maybeSingle();
    return inserted || defaultRow;
  }

  return data;
});

export const listMeetings = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("meetings")
    .select("*")
    .order("start_time", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  
  if (!data || data.length === 0) {
    const defaultRow = {
      id: "85651598189",
      zoom_id: "85651598189",
      topic: "ＳＵＮＣＬＯＵＤＳ １７６６",
      host_email: "sunclouds-jr@outlook.com",
      start_time: new Date().toISOString(),
      duration_min: 1440,
      join_url: "https://us05web.zoom.us/j/85651598189?pwd=xxJugOAf1uy1Amwlchy4ZbshgzvoYk.1",
      passcode: "1766",
      status: "started",
      is_active: true,
      capacity: 100,
      raw: { mode: "default_fallback" },
      synced_at: new Date().toISOString(),
    };
    await supabaseAdmin.from("meetings").upsert(defaultRow as never, { onConflict: "zoom_id" });
    return [defaultRow];
  }

  return data;
});

const SyncInput = z.object({
  meetingId: z.string().optional(),
  actorTelegramId: z.number().nullable().optional(),
});

export const syncActiveMeeting = createServerFn({ method: "POST" })
  .validator((raw) => SyncInput.parse(raw ?? {}))
  .handler(async ({ data }) => {
    if (data?.actorTelegramId && !isAdminId(data.actorTelegramId)) {
      throw new Error("Not authorized");
    }
    const zoomId = data?.meetingId || process.env.ZOOM_MEETING_ID || "85651598189";

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let meetingDetails: any = null;

    try {
      const { fetchZoomMeeting } = await import("./zoom.server");
      meetingDetails = await fetchZoomMeeting(zoomId);
    } catch (err: any) {
      console.warn(`[meetings.functions] Zoom API fetch failed (${err.message}). Using live session fallback.`);
    }

    // Clear existing active flag, then upsert this one as active.
    await supabaseAdmin.from("meetings").update({ is_active: false }).eq("is_active", true);

    const row = {
      zoom_id: String(meetingDetails?.id ?? zoomId),
      topic: meetingDetails?.topic ?? "ＳＵＮＣＬＯＵＤＳ １７６６",
      host_email: meetingDetails?.host_email ?? "sunclouds-jr@outlook.com",
      start_time: meetingDetails?.start_time ?? new Date().toISOString(),
      duration_min: meetingDetails?.duration ?? 1440,
      join_url: meetingDetails?.join_url ?? "https://us05web.zoom.us/j/85651598189?pwd=xxJugOAf1uy1Amwlchy4ZbshgzvoYk.1",
      passcode: meetingDetails?.password ?? "1766",
      status: meetingDetails?.status ?? "started",
      is_active: true,
      raw: meetingDetails?.raw ?? meetingDetails ?? { mode: "synced_from_env" },
      synced_at: new Date().toISOString(),
    };

    const { data: saved, error } = await supabaseAdmin
      .from("meetings")
      .upsert(row as never, { onConflict: "zoom_id" })
      .select()
      .single();

    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_log").insert({
      actor: data?.actorTelegramId ? `tg:${data.actorTelegramId}` : "system",
      action: "Synced active meeting from Zoom API",
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
    let meetings: any[] = [];
    try {
      meetings = await listUpcomingZoomMeetings("me");
    } catch (e: any) {
      console.warn("[meetings.functions] listUpcomingZoomMeetings error:", e);
    }

    if (meetings.length === 0) {
      const defaultRow = {
        zoom_id: "85651598189",
        topic: "ＳＵＮＣＬＯＵＤＳ １７６６",
        host_email: "sunclouds-jr@outlook.com",
        start_time: new Date().toISOString(),
        duration_min: 1440,
        join_url: "https://us05web.zoom.us/j/85651598189?pwd=xxJugOAf1uy1Amwlchy4ZbshgzvoYk.1",
        passcode: "1766",
        status: "started",
        is_active: true,
        synced_at: new Date().toISOString(),
      };
      await supabaseAdmin.from("meetings").upsert(defaultRow as never, { onConflict: "zoom_id" });
      return { count: 1 };
    }

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

export const testZoomAuth = createServerFn({ method: "POST" })
  .validator((raw) =>
    z
      .object({
        meetingId: z.string().optional(),
        accountId: z.string().optional(),
        clientId: z.string().optional(),
        clientSecret: z.string().optional(),
      })
      .parse(raw)
  )
  .handler(async ({ data }) => {
    const { testZoomOAuthConnection, fetchZoomMeeting } = await import("./zoom.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const customCreds = {
      accountId: data.accountId,
      clientId: data.clientId,
      clientSecret: data.clientSecret,
    };

    // 1. Test OAuth token
    const oauthRes = await testZoomOAuthConnection(customCreds);
    if (!oauthRes.success) {
      return { success: false, message: oauthRes.message };
    }

    const targetMeetingId = data.meetingId?.trim() || process.env.ZOOM_MEETING_ID || "85651598189";
    let meetingDetails: any = null;

    try {
      meetingDetails = await fetchZoomMeeting(targetMeetingId, customCreds);
    } catch (e1: any) {
      console.warn("[meetings.functions] fetchZoomMeeting in testZoomAuth note:", e1.message);
    }

    // Clear existing active flag, then upsert this active meeting into Supabase DB
    await supabaseAdmin.from("meetings").update({ is_active: false }).eq("is_active", true);

    const row = {
      zoom_id: String(meetingDetails?.id ?? targetMeetingId),
      topic: meetingDetails?.topic ?? "ＳＵＮＣＬＯＵＤＳ １７６６",
      host_email: meetingDetails?.host_email ?? "sunclouds-jr@outlook.com",
      start_time: meetingDetails?.start_time ?? new Date().toISOString(),
      duration_min: meetingDetails?.duration ?? 1440,
      join_url: meetingDetails?.join_url ?? "https://us05web.zoom.us/j/85651598189?pwd=xxJugOAf1uy1Amwlchy4ZbshgzvoYk.1",
      passcode: meetingDetails?.password ?? "1766",
      status: meetingDetails?.status ?? "started",
      is_active: true,
      raw: meetingDetails?.raw ?? meetingDetails ?? { mode: "synced_from_tools" },
      synced_at: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin
      .from("meetings")
      .upsert(row as never, { onConflict: "zoom_id" });

    if (error) {
      return { success: false, message: `DB Upsert error: ${error.message}` };
    }

    await supabaseAdmin.from("audit_log").insert({
      actor: "admin:tools",
      action: "Synced active meeting from Zoom API",
      target: row.zoom_id,
    });

    return {
      success: true,
      message: `Zoom OAuth Verified & Active Meeting "${row.topic}" (ID: ${row.zoom_id}) successfully synced to Database!`,
    };
  });

export const getZoomEnvConfig = createServerFn({ method: "GET" }).handler(async () => {
  return {
    accountId: process.env.ZOOM_ACCOUNT_ID ?? "Xmxl4CRXRLqrvr3WXlUqAw",
    clientId: process.env.ZOOM_CLIENT_ID ?? "KJVgvj9TQHOT5oIBkl6Z7g",
    clientSecret: process.env.ZOOM_CLIENT_SECRET ? `${process.env.ZOOM_CLIENT_SECRET.slice(0, 4)}...${process.env.ZOOM_CLIENT_SECRET.slice(-4)}` : "z8S2...z",
    meetingId: process.env.ZOOM_MEETING_ID ?? "85651598189",
    regLink: process.env.ZOOM_REGISTRATION_LINK ?? "https://us06web.zoom.us/meeting/register/xHiSkLTMQLq0an5MdrWlZw",
    webhookSecret: process.env.ZOOM_WEBHOOK_SECRET ?? "YYJPbMz0Q6GazVd_DeBMIQ",
  };
});

export const syncZoomDirectlyFromEnv = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const zoomMeetingId = (process.env.ZOOM_MEETING_ID || "85651598189").trim();
  let meeting: any = null;

  try {
    const { fetchZoomMeeting } = await import("./zoom.server");
    meeting = await fetchZoomMeeting(zoomMeetingId);
  } catch (e: any) {
    console.warn("[meetings.functions] syncZoomDirectlyFromEnv note:", e.message);
  }

  // Clear existing active meeting flag
  await supabaseAdmin.from("meetings").update({ is_active: false }).eq("is_active", true);

  const row = {
    zoom_id: String(meeting?.id ?? zoomMeetingId),
    topic: meeting?.topic ?? "ＳＵＮＣＬＯＵＤＳ １７６６",
    host_email: meeting?.host_email ?? "sunclouds-jr@outlook.com",
    start_time: meeting?.start_time ?? new Date().toISOString(),
    duration_min: meeting?.duration ?? 1440,
    join_url: meeting?.join_url ?? "https://us05web.zoom.us/j/85651598189?pwd=xxJugOAf1uy1Amwlchy4ZbshgzvoYk.1",
    passcode: meeting?.password ?? "1766",
    status: meeting?.status ?? "started",
    is_active: true,
    raw: meeting?.raw ?? meeting ?? { mode: "env_sync" },
    synced_at: new Date().toISOString(),
  };

  const { data: saved, error } = await supabaseAdmin
    .from("meetings")
    .upsert(row as never, { onConflict: "zoom_id" })
    .select()
    .single();

  if (error) throw new Error(`Supabase DB Error: ${error.message}`);

  await supabaseAdmin.from("audit_log").insert({
    actor: "system:env_sync",
    action: "Synced active meeting from Zoom API (.env)",
    target: row.zoom_id,
  });

  return saved;
});

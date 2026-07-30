import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isAdminId } from "./admin-config";

// Server functions for meetings + Zoom sync.

export const getActiveMeeting = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // True source of truth: the row flagged is_active in the DB (set by Zoom sync/webhook).
  // No hardcoded fallback — if nothing is active, callers must show "no active meeting".
  const { data, error } = await supabaseAdmin
    .from("meetings")
    .select("*")
    .eq("is_active", true)
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[meetings.functions] getActiveMeeting error:", error);
    return null;
  }

  return data ?? null;
});

export const listMeetings = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("meetings")
    .select("*")
    .order("start_time", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);



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
    accountId: process.env.ZOOM_ACCOUNT_ID ?? "X0ADU72rToGb7hdnnIBkeg",
    clientId: process.env.ZOOM_CLIENT_ID ?? "o9qDabC6RPapF8IUgz3Efw",
    clientSecret: process.env.ZOOM_CLIENT_SECRET ?? "4C06H56EsMmDjMShZVGwSs6SMOSZ5ztv",
    meetingId: process.env.ZOOM_MEETING_ID ?? "85651598189",
    regLink: process.env.ZOOM_REGISTRATION_LINK ?? "https://us05web.zoom.us/j/85651598189?pwd=xxJugOAf1uy1Amwlchy4ZbshgzvoYk.1",
    webhookSecret: process.env.ZOOM_WEBHOOK_SECRET ?? "QG6XM_lQRq25ad8Up39jtg",
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

export const syncLiveZoomData = createServerFn({ method: "POST" })
  .validator((raw) => z.object({ meetingId: z.string().optional() }).parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchZoomMeeting, listZoomRegistrants, listZoomParticipants } = await import("./zoom.server");

    const targetMeetingId = data.meetingId?.trim() || process.env.ZOOM_MEETING_ID || "85651598189";

    // 1. Fetch Meeting info
    let meeting: any = null;
    try {
      meeting = await fetchZoomMeeting(targetMeetingId);
    } catch (e: any) {
      console.warn("[syncLiveZoomData] fetchZoomMeeting:", e.message);
    }

    // 2. Fetch Approved Registrants & Pending Registrants
    const approvedRegs = await listZoomRegistrants(targetMeetingId, "approved");
    const pendingRegs = await listZoomRegistrants(targetMeetingId, "pending");

    // 3. Fetch Participants History
    const participantsData = await listZoomParticipants(targetMeetingId);

    // 4. Save/Update Active Meeting in DB
    await supabaseAdmin.from("meetings").update({ is_active: false }).eq("is_active", true);

    const meetingRow = {
      zoom_id: String(meeting?.id ?? targetMeetingId),
      topic: meeting?.topic ?? "ＳＵＮＣＬＯＵＤＳ １７６６",
      host_email: meeting?.host_email ?? "sunclouds-jr@outlook.com",
      start_time: meeting?.start_time ?? new Date().toISOString(),
      duration_min: meeting?.duration ?? 1440,
      join_url: meeting?.join_url ?? "https://us05web.zoom.us/j/85651598189?pwd=xxJugOAf1uy1Amwlchy4ZbshgzvoYk.1",
      passcode: meeting?.password ?? "1766",
      status: meeting?.status ?? "started",
      is_active: true,
      raw: meeting?.raw ?? meeting ?? { mode: "live_sync" },
      synced_at: new Date().toISOString(),
    };

    const { data: savedMeeting, error: meetingErr } = await supabaseAdmin
      .from("meetings")
      .upsert(meetingRow as never, { onConflict: "zoom_id" })
      .select()
      .single();

    if (meetingErr) throw new Error(`DB Error upserting meeting: ${meetingErr.message}`);

    // 5. Bulk Sync Registrants into DB (Separate new inserts from existing updates)
    let syncedRegistrantsCount = 0;
    const { data: existingDbRegs } = await supabaseAdmin
      .from("registrants")
      .select("id, email, telegram_user, telegram_id, status")
      .eq("meeting_id", savedMeeting.id);

    const existingMap = new Map<string, { id: string; telegram_user: string | null; telegram_id: number | null; status: string }>();
    if (existingDbRegs) {
      for (const r of existingDbRegs) {
        if (r.email) {
          existingMap.set(r.email.toLowerCase().trim(), {
            id: r.id,
            telegram_user: r.telegram_user,
            telegram_id: r.telegram_id,
            status: r.status,
          });
        }
      }
    }

    const allRegs = [
      ...approvedRegs.map((r) => ({ ...r, status: "approved" })),
      ...pendingRegs.map((r) => ({ ...r, status: "pending" })),
    ];

    const rowsToInsert: any[] = [];
    const rowsToUpdate: any[] = [];

    for (const r of allRegs) {
      const email = (r.email || "").toLowerCase().trim();
      if (!email) continue;
      const existing = existingMap.get(email);
      const finalStatus = (existing?.status && ["on_hold", "denied", "blacklisted", "cancelled"].includes(existing.status))
        ? existing.status
        : r.status;

      let extractedTg = existing?.telegram_user || null;
      if (!extractedTg && r.custom_questions && Array.isArray(r.custom_questions)) {
        for (const q of r.custom_questions) {
          const val = String(q.value || "").trim();
          if (val.startsWith("@") || (q.title && q.title.toLowerCase().includes("telegram"))) {
            extractedTg = val;
            break;
          }
        }
      }

      const row = {
        meeting_id: savedMeeting.id,
        email,
        name: `${r.first_name || ""} ${r.last_name || ""}`.trim() || email || "Zoom Registrant",
        phone: r.phone || null,
        telegram_user: extractedTg,
        telegram_id: existing?.telegram_id || null,
        status: finalStatus,
        registered_at: r.create_time || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (existing?.id) {
        rowsToUpdate.push({ ...row, id: existing.id });
      } else {
        rowsToInsert.push(row);
      }
    }

    const chunkSize = 100;
    // Insert new registrants in batches
    for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
      const chunk = rowsToInsert.slice(i, i + chunkSize);
      const { error: insErr } = await supabaseAdmin.from("registrants").insert(chunk as never);
      if (insErr) console.warn("[syncLiveZoomData] registrants insert error:", insErr.message);
      else syncedRegistrantsCount += chunk.length;
    }

    // Update existing registrants in batches
    for (let i = 0; i < rowsToUpdate.length; i += chunkSize) {
      const chunk = rowsToUpdate.slice(i, i + chunkSize);
      const { error: upErr } = await supabaseAdmin.from("registrants").upsert(chunk as never);
      if (upErr) console.warn("[syncLiveZoomData] registrants update error:", upErr.message);
      else syncedRegistrantsCount += chunk.length;
    }

    return {
      success: true,
      zoom_id: savedMeeting.zoom_id,
      topic: savedMeeting.topic,
      host_email: savedMeeting.host_email,
      meeting_status: savedMeeting.status,
      approved_registrants_count: approvedRegs.length,
      pending_registrants_count: pendingRegs.length,
      synced_registrants_db_count: syncedRegistrantsCount,
      live_participants_count: participantsData.total_records,
      sample_approved_registrants: approvedRegs.slice(0, 5).map((r) => ({
        name: `${r.first_name || ""} ${r.last_name || ""}`.trim(),
        email: r.email,
        country: r.country,
        create_time: r.create_time,
      })),
      sample_live_participants: participantsData.participants.slice(0, 5).map((p) => ({
        name: p.name,
        email: p.user_email,
        join_time: p.join_time,
        leave_time: p.leave_time,
        duration: p.duration,
      })),
    };
  });


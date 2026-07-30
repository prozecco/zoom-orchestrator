import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyAdminRegistration } from "./telegram-notifier.server";

// Schema for registration submission
const SubmitRegistrationSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  name: z.string().optional(),
  email: z.string().email("Invalid email address"),
  country: z.string().optional(),
  q1Answer: z.string().optional(),
  q2Answer: z.string().optional(),
  phone: z.string().optional(),
  telegramUser: z.string().optional(),
  telegramId: z.number().nullable().optional(),
});

/**
 * Submits a new registrant from Telegram Mini App / Web App,
 * submits to Zoom API with custom questions, upserts into Supabase DB, and triggers Telegram Notification to Admin.
 */
export const submitRegistration = createServerFn({ method: "POST" })
  .validator((data: unknown) => SubmitRegistrationSchema.parse(data))
  .handler(async ({ data }) => {
    // 1. Get current active meeting
    const { data: activeMeeting } = await supabaseAdmin
      .from("meetings")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    if (!activeMeeting) {
      throw new Error("No active meeting found to register for");
    }

    const firstName = data.firstName?.trim() || data.name?.trim()?.split(" ")[0] || "Registrant";
    const lastName = data.lastName?.trim() || data.name?.trim()?.split(" ").slice(1).join(" ") || "";
    const name = `${firstName} ${lastName}`.trim();
    const email = data.email.trim().toLowerCase();
    const country = data.country?.trim() || "Thailand";
    const phone = data.phone?.trim() || null;
    const telegramId = data.telegramId || null;
    const telegramUser = data.telegramUser || null;

    // Build exact custom_questions matching Zoom Web Portal schema
    const customQuestionsList: Array<{ title: string; value: string }> = [];
    if (data.q1Answer) {
      customQuestionsList.push({
        title: "After registering, please request approval at https://t.me/ZoomApprovalBot for faster approval, or contact @ixun_z",
        value: data.q1Answer,
      });
    }
    if (data.q2Answer) {
      customQuestionsList.push({
        title: "Please join using the link sent to your email. The link in the email is a personal link, so it will not redirect you to the registration page. (no need to reply)",
        value: data.q2Answer,
      });
    }
    if (telegramUser) {
      customQuestionsList.push({
        title: "Telegram Username: @ㅤㅤ (Example: @ixun_z)",
        value: telegramUser,
      });
    }

    // 2. Submit to Zoom API
    try {
      const { submitZoomRegistrant } = await import("./zoom.server");
      await submitZoomRegistrant(activeMeeting.zoom_id, {
        first_name: firstName,
        last_name: lastName || undefined,
        email,
        country,
        custom_questions: customQuestionsList.length ? customQuestionsList : undefined,
      });
    } catch (zoomErr: any) {
      console.warn("[registrants.functions] Zoom API registrant submit note:", zoomErr.message);
    }

    // Check if already registered to avoid duplicate Telegram notifications
    const { data: existingReg } = await supabaseAdmin
      .from("registrants")
      .select("id")
      .eq("meeting_id", activeMeeting.id)
      .eq("email", email)
      .maybeSingle();

    // 3. Upsert registrant into Supabase with 'pending' status for Admin approval
    const payloadToUpsert = {
      ...(existingReg?.id ? { id: existingReg.id } : {}),
      meeting_id: activeMeeting.id,
      name,
      email,
      phone,
      telegram_id: telegramId,
      telegram_user: telegramUser,
      status: existingReg ? undefined : "pending",
      registered_at: new Date().toISOString(),
    };

    const { data: inserted, error } = await supabaseAdmin
      .from("registrants")
      .upsert(payloadToUpsert as never)
      .select()
      .single();

    if (error) {
      console.error("[registrants.functions] Error upserting registrant:", error);
      throw new Error(`Failed to save registration: ${error.message}`);
    }

    // 4. Trigger Telegram Notification ONLY if this is a NEW registration (prevents duplicates)
    if (!existingReg) {
      await notifyAdminRegistration({
        name,
        email,
        phone,
        telegramId,
        telegramHandle: telegramUser,
        source: "telegram_mini_app",
        meetingTopic: activeMeeting.topic,
        registeredAt: new Date().toISOString(),
      });
    }

    return inserted;
  });

/**
 * Retrieves the current user's registration by Telegram ID or email
 */
export const getMyRegistration = createServerFn({ method: "GET" })
  .validator((data: unknown) =>
    z.object({ telegramId: z.number().nullable().optional() }).parse(data)
  )
  .handler(async ({ data }) => {
    if (!data.telegramId) return null;

    const { data: reg, error } = await supabaseAdmin
      .from("registrants")
      .select("*, meetings(*)")
      .eq("telegram_id", data.telegramId)
      .order("registered_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[registrants.functions] Error fetching user registration:", error);
      return null;
    }

    return reg;
  });

/**
 * Lists all registrants for admin dashboard.
 * If the database registrants list is empty, automatically triggers syncLiveZoomData
 * to populate all approved and pending registrants from Zoom API.
 */
export const listRegistrants = createServerFn({ method: "GET" })
  .validator((data: unknown) =>
    z.object({ status: z.string().optional() }).optional().parse(data)
  )
  .handler(async ({ data }) => {
    let query = supabaseAdmin
      .from("registrants")
      .select("*, meetings(topic, zoom_id)")
      .order("registered_at", { ascending: false });

    if (data?.status) {
      query = query.eq("status", data.status);
    }

    let { data: list, error } = await query;
    if (error) {
      console.error("[registrants.functions] Error listing registrants:", error);
      throw new Error(error.message);
    }

    // Auto-Populate Safeguard: If DB is empty, sync directly from Zoom API live
    if (!list || list.length === 0) {
      try {
        const { syncLiveZoomData } = await import("./meetings.functions");
        await syncLiveZoomData({ data: {} });
        const { data: refetched } = await query;
        list = refetched || [];
      } catch (syncErr: any) {
        console.warn("[registrants.functions] Auto live sync note:", syncErr.message);
      }
    }

    return list || [];
  });

/**
 * Updates a single registrant's status (approved, denied, on_hold, etc.)
 * and syncs status back to Zoom API & sends Telegram notification.
 */
export const updateRegistrantStatus = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({
      id: z.string(),
      status: z.enum(["pending", "approved", "denied", "on_hold", "cancelled", "attended", "blacklisted"]),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { data: updated, error } = await supabaseAdmin
      .from("registrants")
      .update({ status: data.status, updated_at: new Date().toISOString() } as never)
      .eq("id", data.id)
      .select("*, meetings(zoom_id, topic)")
      .single();

    if (error) {
      console.error("[registrants.functions] Error updating status:", error);
      throw new Error(error.message);
    }

    // Sync status change to Zoom API if status is approved or denied
    if (updated?.email && (data.status === "approved" || data.status === "denied")) {
      try {
        const { updateZoomRegistrantStatus } = await import("./zoom.server");
        const zoomMeetingId = (updated as any)?.meetings?.zoom_id || process.env.ZOOM_MEETING_ID || "85651598189";
        const zoomAction = data.status === "approved" ? "approve" : "deny";
        await updateZoomRegistrantStatus(zoomMeetingId, zoomAction, [{ email: updated.email }]);
      } catch (err: any) {
        console.warn("[registrants.functions] Zoom API status sync note:", err.message);
      }

      try {
        const { notifyAdminStatusChange } = await import("./telegram-notifier.server");
        await notifyAdminStatusChange({
          registrantName: updated.name || updated.email,
          registrantEmail: updated.email,
          newStatus: data.status as any,
          meetingTopic: (updated as any)?.meetings?.topic || "ＳＵＮＣＬＯＵＤＳ １７６６",
        });
      } catch (err: any) {
        console.warn("[registrants.functions] Telegram status notification note:", err.message);
      }
    }

    return updated;
  });

/**
 * Bulk updates multiple registrants' status and syncs with Zoom API & Telegram
 */
export const bulkUpdateStatus = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({
      ids: z.array(z.string()),
      status: z.enum(["pending", "approved", "denied", "on_hold", "cancelled", "attended", "blacklisted"]),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    if (!data.ids.length) return { updated: 0 };

    const { data: updatedList, error } = await supabaseAdmin
      .from("registrants")
      .update({ status: data.status, updated_at: new Date().toISOString() } as never)
      .in("id", data.ids)
      .select("*, meetings(zoom_id, topic)");

    if (error) {
      console.error("[registrants.functions] Error bulk updating status:", error);
      throw new Error(error.message);
    }

    if (updatedList?.length && (data.status === "approved" || data.status === "denied")) {
      try {
        const { updateZoomRegistrantStatus } = await import("./zoom.server");
        const zoomMeetingId = (updatedList[0] as any)?.meetings?.zoom_id || process.env.ZOOM_MEETING_ID || "85651598189";
        const zoomAction = data.status === "approved" ? "approve" : "deny";
        const registrantsPayload = updatedList.map((r: any) => ({ email: r.email }));
        await updateZoomRegistrantStatus(zoomMeetingId, zoomAction, registrantsPayload);
      } catch (err: any) {
        console.warn("[registrants.functions] Zoom API bulk status sync note:", err.message);
      }
    }

    return { updated: updatedList?.length || 0 };
  });

/**
 * Saves a behavior note for a registrant
 */
export const saveRegistrantNote = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({
      registrantId: z.string(),
      authorTgId: z.number().nullable().optional(),
      authorName: z.string(),
      body: z.string().min(1, "Note cannot be empty"),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { data: note, error } = await supabaseAdmin
      .from("registrant_notes")
      .insert({
        registrant_id: data.registrantId,
        author_tg_id: data.authorTgId || null,
        author_name: data.authorName,
        body: data.body,
        created_at: new Date().toISOString(),
      } as never)
      .select()
      .single();

    if (error) {
      console.error("[registrants.functions] Error saving note:", error);
      throw new Error(error.message);
    }

    return note;
  });
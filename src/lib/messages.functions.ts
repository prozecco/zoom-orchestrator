import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Schema definitions
const SendChatMessageSchema = z.object({
  meetingId: z.string(),
  registrantId: z.string().optional(),
  recipientEmail: z.string().optional(),
  fromRole: z.enum(["admin", "attendee", "host"]),
  fromName: z.string(),
  text: z.string().min(1, "Message text cannot be empty"),
  channel: z.enum(["dm", "meeting_1to1", "meeting_central"]).optional(),
});

/**
 * Sends a chat message, saves to Supabase DB, and if a recipient email is present,
 * syncs the message directly to Zoom Team Chat API (1:1 Direct Message).
 */
export const sendChatMessage = createServerFn({ method: "POST" })
  .validator((data: unknown) => SendChatMessageSchema.parse(data))
  .handler(async ({ data }) => {
    const { data: inserted, error } = await supabaseAdmin
      .from("messages")
      .insert({
        meeting_id: data.meetingId,
        registrant_id: data.registrantId || null,
        from_role: data.fromRole,
        from_name: data.fromName,
        text: data.text,
        channel: data.channel || "meeting_central",
        created_at: new Date().toISOString(),
      } as never)
      .select()
      .single();

    if (error) {
      console.error("[messages.functions] Error sending message:", error);
      throw new Error(`Failed to send message: ${error.message}`);
    }

    // Bidirectional Sync: If recipient email is provided, send to Zoom Team Chat API live
    if (data.recipientEmail && (data.channel === "dm" || data.channel === "meeting_1to1")) {
      try {
        const { sendZoomDirectMessage } = await import("./zoom.server");
        await sendZoomDirectMessage(data.recipientEmail.trim(), data.text);
      } catch (zoomErr: any) {
        console.warn("[messages.functions] Zoom Team Chat direct message sync note:", zoomErr.message);
      }
    }

    return inserted;
  });

/**
 * Syncs 1:1 Direct Messages from Zoom Team Chat API back into Supabase DB.
 * Enables seamless back-and-forth messaging between Zoom Chat App and this Orchestrator.
 */
export const syncZoomDirectMessages = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ recipientEmail: z.string(), meetingId: z.string(), registrantId: z.string().optional() }).parse(data))
  .handler(async ({ data }) => {
    try {
      const { listZoomDirectMessages } = await import("./zoom.server");
      const zoomMsgs = await listZoomDirectMessages(data.recipientEmail);

      if (zoomMsgs?.length) {
        for (const msg of zoomMsgs) {
          const msgText = msg.message;
          const msgTime = msg.date_time || new Date().toISOString();

          // Upsert or check existing message in Supabase
          const { data: existing } = await supabaseAdmin
            .from("messages")
            .select("id")
            .eq("meeting_id", data.meetingId)
            .eq("text", msgText)
            .maybeSingle();

          if (!existing) {
            await supabaseAdmin.from("messages").insert({
              meeting_id: data.meetingId,
              registrant_id: data.registrantId || null,
              from_role: msg.sender?.includes("@") ? "attendee" : "host",
              from_name: msg.sender || data.recipientEmail,
              text: msgText,
              channel: "dm",
              created_at: msgTime,
            } as never);
          }
        }
      }
      return { syncedCount: zoomMsgs.length };
    } catch (err: any) {
      console.warn("[messages.functions] syncZoomDirectMessages note:", err.message);
      return { syncedCount: 0 };
    }
  });

export const listCentralMessages = createServerFn({ method: "GET" })
  .validator((data: unknown) => z.object({ meetingId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { data: messages, error } = await supabaseAdmin
      .from("messages")
      .select("*")
      .eq("meeting_id", data.meetingId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[messages.functions] Error fetching central messages:", error);
      return [];
    }

    return messages || [];
  });

export const listThreadMessages = createServerFn({ method: "GET" })
  .validator((data: unknown) => z.object({ registrantId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { data: messages, error } = await supabaseAdmin
      .from("messages")
      .select("*")
      .eq("registrant_id", data.registrantId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[messages.functions] Error fetching thread messages:", error);
      return [];
    }

    return messages || [];
  });

export const listApprovedRegistrants = createServerFn({ method: "GET" })
  .validator((data: unknown) => z.object({ meetingId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { data: meeting } = await supabaseAdmin
      .from("meetings")
      .select("id, zoom_id")
      .or(`id.eq.${data.meetingId},zoom_id.eq.${data.meetingId}`)
      .maybeSingle();

    const keys = [meeting?.id, meeting?.zoom_id, data.meetingId].filter(Boolean) as string[];

    const { data: list, error } = await supabaseAdmin
      .from("registrants")
      .select("*")
      .in("meeting_id", Array.from(new Set(keys)))
      .in("status", ["approved", "attended"])
      .order("name", { ascending: true });

    if (error) {
      console.error("[messages.functions] Error listing registrants:", error);
      return [];
    }

    return list || [];
  });

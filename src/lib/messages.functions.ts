import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Schema definitions
const SendChatMessageSchema = z.object({
  meetingId: z.string(),
  registrantId: z.string().optional(),
  fromRole: z.enum(["admin", "attendee", "host"]),
  fromName: z.string(),
  text: z.string().min(1, "Message text cannot be empty"),
  channel: z.enum(["dm", "meeting_1to1", "meeting_central"]).optional(),
});

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

    return inserted;
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
    // Resolve the meeting first so we can match registrants stored by either
    // the meetings.id (uuid) or the zoom_id, and never leak other meetings' people.
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

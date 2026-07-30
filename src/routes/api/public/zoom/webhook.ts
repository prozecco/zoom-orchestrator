import { createFileRoute } from "@tanstack/react-router";
import { notifyAdminRegistration } from "@/lib/telegram-notifier.server";

// Zoom Webhook endpoint. Public route (bypasses Auth) — handles Zoom CRC validation & Event Subscriptions.

async function computeHmacSha256(plainToken: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(plainToken);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const Route = createFileRoute("/api/public/zoom/webhook")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json({
          ok: true,
          status: "active",
          endpoint: "/api/public/zoom/webhook",
          message: "Zoom Webhook Receiver is ready. Send POST requests from Zoom Marketplace Event Subscriptions.",
        });
      },
      POST: async ({ request }) => {
        const secretToken =
          process.env.ZOOM_WEBHOOK_SECRET_TOKEN ||
          process.env.ZOOM_WEBHOOK_SECRET ||
          process.env.ZOOM_CLIENT_SECRET ||
          "QG6XM_lQRq25ad8Up39jtg";

        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON payload", { status: 400 });
        }

        // 1. Handle Zoom Challenge-Response Check (CRC) for URL Validation
        if (body?.event === "endpoint.url_validation" && body?.payload?.plainToken) {
          const plainToken = body.payload.plainToken;
          const encryptedToken = await computeHmacSha256(plainToken, secretToken);
          return Response.json({
            plainToken,
            encryptedToken,
          });
        }

        const event = body?.event;
        const eventPayload = body?.payload;

        console.log(`[zoom-webhook] Received event: ${event}`);

        try {
          // 2. Handle Meeting Registration Created (Zoom Web Portal registration)
          if (event === "meeting.registration_created") {
            const registrant = eventPayload?.object?.registrant;
            const meetingId = String(eventPayload?.object?.id || "");
            const topic = eventPayload?.object?.topic || "ＳＵＮＣＬＯＵＤＳ １７６６";

            if (registrant && registrant.email) {
              const name = `${registrant.first_name || ""} ${registrant.last_name || ""}`.trim() || registrant.email;
              const email = registrant.email.trim().toLowerCase();
              const phone = registrant.phone || null;

              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              
              // 1. Find matching meeting UUID by zoom_id or active fallback
              let meetingObj: any = null;
              if (meetingId) {
                const { data: found } = await supabaseAdmin
                  .from("meetings")
                  .select("id, topic")
                  .eq("zoom_id", meetingId)
                  .maybeSingle();
                meetingObj = found;
              }

              if (!meetingObj) {
                const { data: activeFound } = await supabaseAdmin
                  .from("meetings")
                  .select("id, topic")
                  .eq("is_active", true)
                  .maybeSingle();
                meetingObj = activeFound;
              }

              if (meetingObj) {
                // Check if user is already registered in DB for this meeting
                const { data: existingReg } = await supabaseAdmin
                  .from("registrants")
                  .select("id")
                  .eq("meeting_id", meetingObj.id)
                  .eq("email", email)
                  .maybeSingle();

                await supabaseAdmin.from("registrants").upsert({
                  ...(existingReg?.id ? { id: existingReg.id } : {}),
                  meeting_id: meetingObj.id,
                  name,
                  email,
                  phone,
                  zoom_registrant_id: registrant.id || registrant.registrant_id || null,
                  status: existingReg ? undefined : "pending",
                  registered_at: new Date().toISOString(),
                } as never);

                // ONLY send Telegram notification if this is a NEW registration (prevents duplicate alerts)
                if (!existingReg) {
                  await notifyAdminRegistration({
                    name,
                    email,
                    phone,
                    source: "zoom_web_portal",
                    meetingTopic: meetingObj.topic || topic,
                    registeredAt: new Date().toISOString(),
                  });
                }
              }
            }
          }

          // 3. Handle Meeting Chat Message Sent (In-Meeting Live Chat)
          if (event === "meeting.chat_message_sent") {
            const messageObj = eventPayload?.object?.message;
            const meetingId = String(eventPayload?.object?.id || "");

            if (messageObj && messageObj.message) {
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

              let meetingObj: any = null;
              if (meetingId) {
                const { data: found } = await supabaseAdmin
                  .from("meetings")
                  .select("id")
                  .eq("zoom_id", meetingId)
                  .maybeSingle();
                meetingObj = found;
              }

              if (!meetingObj) {
                const { data: activeFound } = await supabaseAdmin
                  .from("meetings")
                  .select("id")
                  .eq("is_active", true)
                  .maybeSingle();
                meetingObj = activeFound;
              }

              if (meetingObj) {
                await supabaseAdmin.from("messages").insert({
                  meeting_id: meetingObj.id,
                  from_role: "attendee",
                  from_name: messageObj.sender_name || "Zoom Participant",
                  text: messageObj.message,
                  created_at: new Date().toISOString(),
                } as never);
              }
            }
          }
        } catch (err) {
          console.error(`[zoom-webhook] Error processing event ${event}:`, err);
        }

        // Always respond 200 OK to Zoom so it registers success
        return Response.json({ ok: true });
      },
    },
  },
});

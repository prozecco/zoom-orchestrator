import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/lib/supabase";
import { getMyRegistration } from "@/lib/registrants.functions";
import { isUserRealtimeEnabled } from "@/lib/realtime-config";
import { toast } from "sonner";

interface RegistrationRow {
  id: string;
  meeting_id: string | null;
  telegram_id: number | null;
  telegram_user: string | null;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  registered_at: string;
  updated_at: string;
  meetings?: {
    id: string;
    zoom_id: string;
    topic: string;
    join_url: string | null;
    passcode: string | null;
    start_time: string | null;
  } | null;
}

/**
 * User Mini-App Real-time Registration Hook
 * 
 * Subscribes to postgres_changes on registrants table filtered by telegram_id.
 * 
 * DEBUG: Check browser console for [Realtime User] logs.
 * Run in console: window.checkRealtime()
 */
export function useMyRegistrationRealtime(telegramId: number | null | undefined) {
  const getMyRegFn = useServerFn(getMyRegistration);
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const [lastEvent, setLastEvent] = useState<string | null>(null);

  const enabled = isUserRealtimeEnabled() && !!telegramId;

  // 1. Initial fetch
  const query = useQuery({
    queryKey: ["myRegistration", telegramId],
    queryFn: async () => {
      console.log("[Realtime User] Fetching registration for telegramId:", telegramId);
      const data = await getMyRegFn({ data: { telegramId: telegramId ?? null } });
      console.log("[Realtime User] Fetched:", data ? "found" : "not found");
      return data;
    },
    enabled: !!telegramId,
    staleTime: Infinity,
  });

  // 2. Realtime subscription
  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      console.log("[Realtime User] Skipped (enabled:", enabled, ", telegramId:", telegramId, ")");
      return;
    }

    const channelName = `user-registration-${telegramId}`;
    console.log("[Realtime User] Subscribing to channel:", channelName);
    setConnectionStatus("connecting");

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "registrants",
          filter: `telegram_id=eq.${telegramId}`,
        },
        (payload) => {
          console.log("[Realtime User] Event:", payload.eventType, payload);
          setLastEvent(`${payload.eventType} at ${new Date().toLocaleTimeString()}`);

          const currentData = queryClient.getQueryData<RegistrationRow>(["myRegistration", telegramId]);

          if (payload.eventType === "INSERT") {
            const newRow = payload.new as RegistrationRow;
            queryClient.setQueryData(["myRegistration", telegramId], newRow);
            toast.success("📝 ลงทะเบียนสำเร็จ! รอการอนุมัติ", { duration: 4000 });
          }
          else if (payload.eventType === "UPDATE") {
            const updatedRow = payload.new as RegistrationRow;
            const oldStatus = currentData?.status;
            const newStatus = updatedRow.status;

            queryClient.setQueryData(["myRegistration", telegramId], (old: RegistrationRow | undefined) => {
              if (!old) return updatedRow;
              return { ...old, ...updatedRow, meetings: old.meetings ?? updatedRow.meetings };
            });

            if (oldStatus !== newStatus) {
              if (newStatus === "approved") {
                toast.success("✅ การลงทะเบียนได้รับการอนุมัติแล้ว!", {
                  duration: 5000,
                  description: "คุณสามารถเข้าร่วมประชุมได้เลย",
                });
              } else if (newStatus === "denied") {
                toast.error("❌ การลงทะเบียนถูกปฏิเสธ", {
                  duration: 5000,
                  description: "กรุณาติดต่อแอดมิน",
                });
              } else if (newStatus === "on_hold") {
                toast.info("⏸️ การลงทะเบียนถูกพักไว้ชั่วคราว", { duration: 4000 });
              }
            }
          }
          else if (payload.eventType === "DELETE") {
            queryClient.setQueryData(["myRegistration", telegramId], null);
            toast.info("🗑️ ข้อมูลการลงทะเบียนถูกลบ", { duration: 3000 });
          }
        }
      )
      .subscribe((status, err) => {
        console.log("[Realtime User] Status:", status, err ? "Error:" + err.message : "");
        if (status === "SUBSCRIBED") {
          setConnectionStatus("connected");
          console.log("[Realtime User] ✅ Connected");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnectionStatus("error");
          console.error("[Realtime User] ❌ Error:", status);
        }
      });

    channelRef.current = channel;

    return () => {
      console.log("[Realtime User] Cleanup channel:", channelName);
      channel.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [queryClient, telegramId, enabled]);

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isLive: enabled && connectionStatus === "connected",
    connectionStatus,
    lastEvent,
  };
}

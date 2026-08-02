import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/lib/supabase";
import { getMyRegistration } from "@/lib/registrants.functions";
import { REALTIME_CHANNELS, REALTIME_EVENTS, isUserRealtimeEnabled } from "@/lib/realtime-config";
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
 * Subscribes to changes on the registrants table filtered by the user's telegram_id.
 * When admin approves/denies the user's registration, the UI updates INSTANTLY.
 * 
 * Only active when REALTIME_MODE === "full".
 * 
 * Usage:
 * ```tsx
 * const { data, isLoading, isLive } = useMyRegistrationRealtime(telegramUserId);
 * ```
 */
export function useMyRegistrationRealtime(telegramId: number | null | undefined) {
  const getMyRegFn = useServerFn(getMyRegistration);
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [lastStatusChange, setLastStatusChange] = useState<string | null>(null);

  const enabled = isUserRealtimeEnabled() && !!telegramId;

  // 1. Initial fetch
  const query = useQuery({
    queryKey: ["myRegistration", telegramId],
    queryFn: () => getMyRegFn({ data: { telegramId: telegramId ?? null } }),
    enabled: !!telegramId,
    staleTime: Infinity,
  });

  // 2. Subscribe to Realtime (only if enabled)
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const channelName = REALTIME_CHANNELS.USER_REGISTRATION(telegramId!);
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: REALTIME_EVENTS.REGISTRANTS_TABLE,
          filter: `telegram_id=eq.${telegramId}`,
        },
        (payload) => {
          const currentData = queryClient.getQueryData<RegistrationRow>(["myRegistration", telegramId]);

          if (payload.eventType === "INSERT") {
            const newRow = payload.new as RegistrationRow;
            queryClient.setQueryData(["myRegistration", telegramId], newRow);
            toast.success("📝 ลงทะเบียนสำเร็จ! รอการอนุมัติจากแอดมิน", { duration: 4000 });
          }

          else if (payload.eventType === "UPDATE") {
            const updatedRow = payload.new as RegistrationRow;
            const oldStatus = currentData?.status;
            const newStatus = updatedRow.status;

            // Merge with existing data to preserve joined meeting info
            queryClient.setQueryData(["myRegistration", telegramId], (old: RegistrationRow | undefined) => {
              if (!old) return updatedRow;
              return { ...old, ...updatedRow, meetings: old.meetings ?? updatedRow.meetings };
            });

            // Status change notifications
            if (oldStatus !== newStatus) {
              setLastStatusChange(newStatus);
              if (newStatus === "approved") {
                toast.success("✅ การลงทะเบียนของคุณได้รับการอนุมัติแล้ว!", {
                  duration: 5000,
                  description: "คุณสามารถเข้าร่วมประชุมได้เลย",
                });
              } else if (newStatus === "denied") {
                toast.error("❌ การลงทะเบียนของคุณถูกปฏิเสธ", {
                  duration: 5000,
                  description: "กรุณาติดต่อแอดมินสำหรับข้อมูลเพิ่มเติม",
                });
              } else if (newStatus === "on_hold") {
                toast.info("⏸️ การลงทะเบียนของคุณถูกพักไว้ชั่วคราว", { duration: 4000 });
              }
            }
          }

          else if (payload.eventType === "DELETE") {
            queryClient.setQueryData(["myRegistration", telegramId], null);
            toast.info("🗑️ ข้อมูลการลงทะเบียนถูกลบออกจากระบบ", { duration: 3000 });
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log(`[Realtime] User channel ${channelName} connected ✅`);
        }
      });

    channelRef.current = channel;

    return () => {
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
    isLive: enabled && !!channelRef.current,
    lastStatusChange,
  };
}

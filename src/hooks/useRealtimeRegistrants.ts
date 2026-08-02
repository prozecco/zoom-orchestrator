import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/lib/supabase";
import { listRegistrants } from "@/lib/registrants.functions";
import { REALTIME_CHANNELS, REALTIME_EVENTS } from "@/lib/realtime-config";
import { toast } from "sonner";

interface RegistrantRow {
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
}

/**
 * Admin Dashboard Real-time Registrants Hook
 * 
 * Combines:
 * 1. Initial data fetch via server function (useQuery)
 * 2. Live Supabase Realtime subscription for INSERT/UPDATE/DELETE on registrants table
 * 
 * When a new registrant signs up (via Zoom Web Portal or Telegram Mini App),
 * the admin list updates INSTANTLY without pressing Sync.
 * 
 * Usage:
 * ```tsx
 * const { data, isLoading, isLive } = useRealtimeRegistrants();
 * ```
 */
export function useRealtimeRegistrants() {
  const listRegs = useServerFn(listRegistrants);
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // 1. Initial fetch via server function
  const query = useQuery({
    queryKey: ["registrants"],
    queryFn: () => listRegs(),
    // ❌ Removed polling — Realtime handles live updates
    // refetchInterval: 5000,
    staleTime: Infinity, // Trust Realtime to keep cache fresh
  });

  // 2. Subscribe to Supabase Realtime
  useEffect(() => {
    // Only run in browser
    if (typeof window === "undefined") return;

    const channel = supabase
      .channel(REALTIME_CHANNELS.ADMIN_REGISTRANTS)
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to INSERT, UPDATE, DELETE
          schema: "public",
          table: REALTIME_EVENTS.REGISTRANTS_TABLE,
        },
        (payload) => {
          const currentData = queryClient.getQueryData<RegistrantRow[]>(["registrants"]) ?? [];

          if (payload.eventType === "INSERT") {
            const newRow = payload.new as RegistrantRow;
            // Avoid duplicates
            const exists = currentData.some((r) => r.id === newRow.id);
            if (!exists) {
              queryClient.setQueryData(["registrants"], [newRow, ...currentData]);
              // Optional: subtle toast for new registration
              toast.info(`📝 มีผู้ลงทะเบียนใหม่: ${newRow.name}`, { duration: 3000 });
            }
          }

          else if (payload.eventType === "UPDATE") {
            const updatedRow = payload.new as RegistrantRow;
            const oldRow = payload.old as RegistrantRow;

            const nextData = currentData.map((r) =>
              r.id === updatedRow.id ? { ...r, ...updatedRow } : r
            );
            queryClient.setQueryData(["registrants"], nextData);

            // Toast on status change
            if (oldRow.status !== updatedRow.status) {
              const statusEmoji = updatedRow.status === "approved" ? "✅" : updatedRow.status === "denied" ? "❌" : "📝";
              toast.info(`${statusEmoji} สถานะ ${updatedRow.name} เปลี่ยนเป็น ${updatedRow.status}`, { duration: 2500 });
            }
          }

          else if (payload.eventType === "DELETE") {
            const deletedRow = payload.old as RegistrantRow;
            const nextData = currentData.filter((r) => r.id !== deletedRow.id);
            queryClient.setQueryData(["registrants"], nextData);
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("[Realtime] Admin registrants channel connected ✅");
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          console.warn("[Realtime] Admin channel disconnected:", status);
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
      console.log("[Realtime] Admin registrants channel cleaned up");
    };
  }, [queryClient]);

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isLive: !!channelRef.current,
  };
}

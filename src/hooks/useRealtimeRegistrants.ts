import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/lib/supabase";
import { listRegistrants } from "@/lib/registrants.functions";
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
 * SUBSCRIBES to Supabase Realtime on 'registrants' table.
 * When ANY insert/update/delete happens, React Query cache updates instantly.
 * 
 * DEBUG: Open browser console and run: window.checkRealtime()
 */
export function useRealtimeRegistrants() {
  const listRegs = useServerFn(listRegistrants);
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const [lastEvent, setLastEvent] = useState<string | null>(null);

  // 1. Initial fetch via server function
  const query = useQuery({
    queryKey: ["registrants"],
    queryFn: async () => {
      console.log("[useRealtimeRegistrants] Fetching initial data...");
      const data = await listRegs();
      console.log("[useRealtimeRegistrants] Fetched", data?.length || 0, "registrants");
      return data;
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false, // Realtime handles updates
  });

  // 2. Subscribe to Supabase Realtime
  useEffect(() => {
    if (typeof window === "undefined") return;

    console.log("[useRealtimeRegistrants] Setting up Realtime subscription...");
    setConnectionStatus("connecting");

    const channel = supabase
      .channel("admin-registrants-v2")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "registrants",
        },
        (payload) => {
          console.log("[Realtime] Event received:", payload.eventType, payload);
          setLastEvent(`${payload.eventType} at ${new Date().toLocaleTimeString()}`);

          const currentData = queryClient.getQueryData<RegistrantRow[]>(["registrants"]) ?? [];

          if (payload.eventType === "INSERT") {
            const newRow = payload.new as RegistrantRow;
            const exists = currentData.some((r) => r.id === newRow.id);
            if (!exists) {
              queryClient.setQueryData(["registrants"], [newRow, ...currentData]);
              toast.info(`📝 มีผู้ลงทะเบียนใหม่: ${newRow.name}`, { duration: 3000 });
              console.log("[Realtime] INSERT processed:", newRow.name);
            } else {
              console.log("[Realtime] INSERT ignored (duplicate):", newRow.id);
            }
          }

          else if (payload.eventType === "UPDATE") {
            const updatedRow = payload.new as RegistrantRow;
            const oldRow = payload.old as RegistrantRow;

            const nextData = currentData.map((r) =>
              r.id === updatedRow.id ? { ...r, ...updatedRow } : r
            );

            // If row not in current cache, add it (edge case)
            if (!currentData.some((r) => r.id === updatedRow.id)) {
              nextData.unshift(updatedRow);
            }

            queryClient.setQueryData(["registrants"], nextData);

            if (oldRow.status !== updatedRow.status) {
              const emoji = updatedRow.status === "approved" ? "✅" : updatedRow.status === "denied" ? "❌" : "📝";
              toast.info(`${emoji} ${updatedRow.name}: ${oldRow.status} → ${updatedRow.status}`, { duration: 2500 });
            }
            console.log("[Realtime] UPDATE processed:", updatedRow.id, updatedRow.status);
          }

          else if (payload.eventType === "DELETE") {
            const deletedRow = payload.old as RegistrantRow;
            const nextData = currentData.filter((r) => r.id !== deletedRow.id);
            queryClient.setQueryData(["registrants"], nextData);
            console.log("[Realtime] DELETE processed:", deletedRow.id);
          }
        }
      )
      .subscribe((status, err) => {
        console.log("[Realtime] Subscription status:", status, err ? "Error: " + err.message : "");
        if (status === "SUBSCRIBED") {
          setConnectionStatus("connected");
          console.log("[Realtime] ✅ Channel connected successfully");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnectionStatus("error");
          console.error("[Realtime] ❌ Channel error:", status, err);
          toast.error("Realtime connection failed. Falling back to manual sync.");
        }
      });

    channelRef.current = channel;

    return () => {
      console.log("[Realtime] Cleaning up channel...");
      channel.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
      setConnectionStatus("connecting");
    };
  }, [queryClient]);

  // 3. Fallback: if Realtime fails, show warning
  const isLive = connectionStatus === "connected";

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isLive,
    connectionStatus,
    lastEvent,
  };
}

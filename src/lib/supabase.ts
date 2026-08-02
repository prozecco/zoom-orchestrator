import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  (typeof import.meta !== "undefined" && (import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL)) ||
  (typeof process !== "undefined" && (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)) ||
  "https://xeipxyibruroppnqzxbo.supabase.co";

const supabaseAnonKey =
  (typeof import.meta !== "undefined" && (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY)) ||
  (typeof process !== "undefined" && (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlaXB4eWlicnVyb3BwbnF6eGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MDQ1NDMsImV4cCI6MjA5OTI4MDU0M30.yc5wLBfISB-n2cYM3_vO46EwGqpSvX3D1TDvE-aBJ7k";

/**
 * Supabase client WITH Realtime enabled for browser.
 * Realtime requires explicit configuration in createClient.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  auth: {
    persistSession: false, // Mini App doesn't need persistent auth
    autoRefreshToken: false,
  },
});

/**
 * Debug helper: Check if Realtime is connected and what tables are subscribed.
 * Call this in browser console: window.checkRealtime()
 */
if (typeof window !== "undefined") {
  (window as any).checkRealtime = () => {
    const channels = (supabase as any).channels || [];
    console.log("[Realtime Debug] Active channels:", channels.length);
    channels.forEach((ch: any, i: number) => {
      console.log(`  Channel ${i}:`, ch.topic, "state:", ch.state);
    });
    return channels;
  };
}

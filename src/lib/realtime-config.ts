/**
 * Supabase Realtime Configuration
 * 
 * Mode A: Admin-only real-time (default)
 * Mode B: Admin + User real-time
 * 
 * Toggle by changing REALTIME_MODE below.
 */

export type RealtimeMode = "admin_only" | "full";

/**
 * 🔧 CONFIG: Choose your real-time mode
 * - "admin_only" → Only admin dashboard gets live updates
 * - "full"       → Both admin dashboard AND user mini-app get live updates
 */
export const REALTIME_MODE: RealtimeMode = "admin_only";

/**
 * Channel names used for Supabase Realtime subscriptions.
 */
export const REALTIME_CHANNELS = {
  /** Admin dashboard: listens to ALL registrant changes */
  ADMIN_REGISTRANTS: "admin-registrants",
  /** User mini-app: listens to changes for a specific telegram user */
  USER_REGISTRATION: (telegramId: number | string) => `user-registration-${telegramId}`,
} as const;

/**
 * Postgres change events we subscribe to.
 */
export const REALTIME_EVENTS = {
  REGISTRANTS_TABLE: "registrants",
  EVENTS: ["INSERT", "UPDATE", "DELETE"] as const,
};

/**
 * Check if user-side real-time is enabled.
 */
export function isUserRealtimeEnabled(): boolean {
  return REALTIME_MODE === "full";
}

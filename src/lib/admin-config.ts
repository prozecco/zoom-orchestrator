import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Hardcoded super admin fallback IDs
const HARDCODED_ADMIN_IDS = new Set<number>([6255415226, 6261237981, 7905968402, -1004310551647]);

export function getAdminIds(): Set<number> {
  const raw1 = process.env.ADMIN_CHAT_ID ?? "";
  const raw2 = process.env.ADMIN_TELEGRAM_IDS ?? "";
  const raw3 = process.env.NOTIFICATION_CHAT_ID ?? "";
  const combined = `${raw1},${raw2},${raw3}`;
  const ids = combined
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n !== 0);

  for (const fallbackId of HARDCODED_ADMIN_IDS) {
    ids.push(fallbackId);
  }
  return new Set(ids);
}

export function isAdminId(id: number | null | undefined): boolean {
  if (!id) return false;
  return getAdminIds().has(Number(id));
}

/**
 * Server function to list all dynamic admin users from Supabase DB `admin_users` table.
 */
export const fetchAdminUsers = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await (supabaseAdmin as any)
    .from("admin_users")
    .select("*")
    .order("assigned_on", { ascending: true });

  if (error) {
    console.error("[admin-config] Error fetching admin_users:", error.message);
    return [
      { id: "owner-1", telegram_id: 6255415226, telegram_username: "@izax619", role: "Super Admin (Owner)" },
      { id: "owner-2", telegram_id: 6261237981, telegram_username: "@iXUN_z", role: "Admin" },
      { id: "owner-3", telegram_id: 7905968402, telegram_username: "@izax_x", role: "Admin" },
      { id: "notif-ch", telegram_id: -1004310551647, telegram_username: "Notification Channel", role: "Bot Channel Target" },
    ];
  }

  return data || [];
});

/**
 * Server function to grant admin access to a new Telegram ID & Username in Supabase DB `admin_users` table.
 */
export const addAdminUser = createServerFn({ method: "POST" })
  .validator((raw) =>
    z.object({
      telegramId: z.number(),
      username: z.string().optional(),
    }).parse(raw)
  )
  .handler(async ({ data }) => {
    const username = data.username ? `@${data.username.replace(/^@/, "")}` : `User ${data.telegramId}`;
    const payload = {
      telegram_id: data.telegramId,
      telegram_username: username,
      assigned_on: new Date().toISOString(),
    };

    const { data: inserted, error } = await (supabaseAdmin as any)
      .from("admin_users")
      .upsert(payload as never, { onConflict: "telegram_id" })
      .select()
      .single();

    if (error) {
      console.error("[admin-config] Error adding admin user:", error.message);
      throw new Error(`Failed to grant admin access: ${error.message}`);
    }

    return inserted;
  });

/**
 * Server function to revoke admin access in Supabase DB `admin_users` table.
 */
export const removeAdminUser = createServerFn({ method: "POST" })
  .validator((raw) => z.object({ id: z.string() }).parse(raw))
  .handler(async ({ data }) => {
    const { error } = await (supabaseAdmin as any)
      .from("admin_users")
      .delete()
      .eq("id", data.id);

    if (error) throw new Error(`Failed to revoke admin access: ${error.message}`);
    return { success: true };
  });

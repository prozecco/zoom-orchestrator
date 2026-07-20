// Parses ADMIN_TELEGRAM_IDS env (comma-separated) into a Set.
// Must only be called inside server-function handlers (reads process.env).

export function getAdminIds(): Set<number> {
  const raw = process.env.ADMIN_TELEGRAM_IDS ?? "";
  const ids = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return new Set(ids);
}

export function isAdminId(id: number | null | undefined): boolean {
  if (!id) return false;
  return getAdminIds().has(Number(id));
}

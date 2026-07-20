/**
 * Time Formatter Utility for Bangkok Timezone (Asia/Bangkok)
 *
 * Requirements:
 * 1. Shows relative time (e.g., "5 นาทีที่แล้ว", "2 ชั่วโมงที่แล้ว", "3 วันที่แล้ว")
 *    calculated relative to Asia/Bangkok current time.
 * 2. If registration date is older than 15 days (>15 days), displays full date and time
 *    in Bangkok timezone (e.g., "12 พ.ค. 2026, 14:30 น.").
 */

export function formatBangkokRegistrationTime(dateString: string): string {
  if (!dateString) return "";

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  // If older than 15 days -> full Bangkok formatted timestamp
  if (diffDays > 15) {
    return (
      new Intl.DateTimeFormat("th-TH", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(date) + " น."
    );
  }

  // Relative time calculations
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) return "เมื่อสักครู่";
  if (diffMinutes < 60) return `${diffMinutes} นาทีที่แล้ว`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;

  const roundedDays = Math.floor(diffHours / 24);
  return `${roundedDays} วันที่แล้ว`;
}

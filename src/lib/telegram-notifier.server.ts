import { sendTelegramMessage } from "./telegram.server";
import { getAdminIds } from "./admin-config";

export interface RegistrationNotificationPayload {
  name: string;
  email: string;
  phone?: string | null;
  telegramId?: number | string | null;
  telegramHandle?: string | null;
  source: "telegram_mini_app" | "zoom_web_portal";
  meetingTopic?: string | null;
  registeredAt?: string | null;
}

/**
 * Formats and broadcasts a Telegram notification to configured Admin(s) 
 * whenever a new registration occurs.
 */
export async function notifyAdminRegistration(payload: RegistrationNotificationPayload): Promise<boolean> {
  try {
    const adminIds = Array.from(getAdminIds());
    if (!adminIds || adminIds.length === 0) {
      console.warn("[telegram-notifier] No admin Telegram IDs found");
      return false;
    }

    const sourceLabel = payload.source === "telegram_mini_app" ? "📱 Telegram Mini App" : "🌐 Zoom Web Portal";
    const timeStr = payload.registeredAt 
      ? new Date(payload.registeredAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })
      : new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });

    const messageLines = [
      `🔔 *มีผู้ลงทะเบียนเข้าร่วมใหม่!*`,
      ``,
      `📌 *ช่องทาง:* ${sourceLabel}`,
      `👤 *ชื่อ-นามสกุล:* ${payload.name}`,
      `📧 *อีเมล:* \`${payload.email}\``,
    ];

    if (payload.phone) {
      messageLines.push(`📞 *เบอร์โทร:* \`${payload.phone}\``);
    }
    if (payload.telegramHandle) {
      messageLines.push(`💬 *Telegram:* @${payload.telegramHandle.replace("@", "")}`);
    } else if (payload.telegramId) {
      messageLines.push(`🆔 *Telegram ID:* \`${payload.telegramId}\``);
    }

    if (payload.meetingTopic) {
      messageLines.push(`📅 *หัวข้อ:* ${payload.meetingTopic}`);
    }

    messageLines.push(`⏰ *เวลา:* ${timeStr}`);

    const text = messageLines.join("\n");

    // Send notification to all configured admins
    for (const adminId of adminIds) {
      try {
        await sendTelegramMessage(adminId, text, { parse_mode: "Markdown" });
      } catch (err) {
        console.error(`[telegram-notifier] Failed to send notification to admin ${adminId}:`, err);
      }
    }

    return true;
  } catch (error) {
    console.error("[telegram-notifier] Exception in notifyAdminRegistration:", error);
    return false;
  }
}

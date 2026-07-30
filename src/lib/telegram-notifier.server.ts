import { sendTelegramMessage } from "./telegram.server";
import { getAdminIds } from "./admin-config";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface RegistrationNotificationPayload {
  name: string;
  email: string;
  phone?: string | null;
  telegramId?: number | string | null;
  telegramHandle?: string | null;
  source: "telegram_mini_app" | "zoom_web_portal";
  meetingTopic?: string | null;
  registeredAt?: string | null;
  customChatId?: number | string | null;
}

/**
 * Formats and broadcasts a Telegram notification to configured Admin(s) 
 * or specified custom chat room whenever a new registration occurs.
 */
export async function notifyAdminRegistration(payload: RegistrationNotificationPayload): Promise<boolean> {
  try {
    const adminIdsSet = getAdminIds();
    
    // If a custom chat room ID was specified, include it
    if (payload.customChatId) {
      const parsed = Number(payload.customChatId);
      if (Number.isFinite(parsed) && parsed !== 0) {
        adminIdsSet.add(parsed);
      }
    }

    const adminIds = Array.from(adminIdsSet);
    if (!adminIds || adminIds.length === 0) {
      console.warn("[telegram-notifier] No admin or target chat IDs found");
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

    // Send notification to all configured admins and target chat room
    for (const chatId of adminIds) {
      try {
        await sendTelegramMessage(chatId, text, { parse_mode: "Markdown" });
      } catch (err) {
        console.error(`[telegram-notifier] Failed to send notification to chat ${chatId}:`, err);
      }
    }

    return true;
  } catch (error) {
    console.error("[telegram-notifier] Exception in notifyAdminRegistration:", error);
    return false;
  }
}

/**
 * Server function to send a test registration alert to a specific Telegram chat room ID.
 */
export const testRegistrationNotification = createServerFn({ method: "POST" })
  .validator((raw) =>
    z.object({
      targetChatId: z.string().optional(),
    }).parse(raw ?? {})
  )
  .handler(async ({ data }) => {
    const targetChat = data.targetChatId?.trim() || process.env.NOTIFICATION_CHAT_ID || process.env.ADMIN_CHAT_ID || "6255415226";
    const chatIdNum = Number(targetChat);

    if (!Number.isFinite(chatIdNum) || chatIdNum === 0) {
      throw new Error(`Invalid Telegram Chat ID: "${targetChat}"`);
    }

    const testPayload: RegistrationNotificationPayload = {
      name: "ทดสอบ ระบบการแจ้งเตือน (Test User)",
      email: "test.user@sunclouds.com",
      phone: "+66812345678",
      telegramHandle: "sunclouds_test",
      source: "telegram_mini_app",
      meetingTopic: "ＳＵＮＣＬＯＵＤＳ １７６６",
      registeredAt: new Date().toISOString(),
      customChatId: chatIdNum,
    };

    const success = await notifyAdminRegistration(testPayload);
    if (!success) {
      throw new Error("Failed to send Telegram notification to target chat room.");
    }

    return {
      success: true,
      message: `ส่งข้อความทดสอบการแจ้งเตือนไปยังห้องแชท Telegram ID "${chatIdNum}" สำเร็จแล้ว!`,
    };
  });

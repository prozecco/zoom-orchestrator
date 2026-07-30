import { sendTelegramMessage } from "./telegram.server";
import { getAdminIds } from "./admin-config";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function escapeHtml(text: string | null | undefined): string {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

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
      `🔔 <b>มีผู้ลงทะเบียนเข้าร่วมใหม่!</b>`,
      ``,
      `📌 <b>ช่องทาง:</b> ${escapeHtml(sourceLabel)}`,
      `👤 <b>ชื่อ-นามสกุล:</b> ${escapeHtml(payload.name)}`,
      `📧 <b>อีเมล:</b> <code>${escapeHtml(payload.email)}</code>`,
    ];

    if (payload.phone) {
      messageLines.push(`📞 <b>เบอร์โทร:</b> <code>${escapeHtml(payload.phone)}</code>`);
    }
    if (payload.telegramHandle) {
      messageLines.push(`💬 <b>Telegram:</b> @${escapeHtml(payload.telegramHandle.replace("@", ""))}`);
    } else if (payload.telegramId) {
      messageLines.push(`🆔 <b>Telegram ID:</b> <code>${escapeHtml(String(payload.telegramId))}</code>`);
    }

    if (payload.meetingTopic) {
      messageLines.push(`📅 <b>หัวข้อ:</b> ${escapeHtml(payload.meetingTopic)}`);
    }

    messageLines.push(`⏰ <b>เวลา:</b> ${escapeHtml(timeStr)}`);

    const text = messageLines.join("\n");

    // Send notification to all configured admins and target chat room using HTML mode
    for (const chatId of adminIds) {
      try {
        await sendTelegramMessage(chatId, text, { parse_mode: "HTML" });
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

export interface StatusChangeNotificationPayload {
  registrantName: string;
  registrantEmail: string;
  newStatus: "approved" | "denied" | "on_hold" | "pending";
  meetingTopic?: string;
}

/**
 * Broadcasts a Telegram notification when a registrant's approval status is updated.
 */
export async function notifyAdminStatusChange(payload: StatusChangeNotificationPayload): Promise<boolean> {
  try {
    const adminIds = Array.from(getAdminIds());
    if (!adminIds.length) return false;

    const statusBadge = payload.newStatus === "approved" 
      ? "✅ อนุมัติสิทธิ์ (Approved)" 
      : payload.newStatus === "denied" 
      ? "❌ ปฏิเสธ (Denied)" 
      : "⏸️ พักการอนุมัติ (On Hold)";

    const text = [
      `📢 <b>อัปเดตสถานะการอนุมัติผู้สมัคร!</b>`,
      ``,
      `👤 <b>ผู้สมัคร:</b> ${escapeHtml(payload.registrantName)}`,
      `📧 <b>อีเมล:</b> <code>${escapeHtml(payload.registrantEmail)}</code>`,
      `🏷️ <b>สถานะใหม่:</b> <b>${escapeHtml(statusBadge)}</b>`,
      payload.meetingTopic ? `📅 <b>หัวข้อ:</b> ${escapeHtml(payload.meetingTopic)}` : "",
      `⏰ <b>เวลา:</b> ${escapeHtml(new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }))}`
    ].filter(Boolean).join("\n");

    for (const chatId of adminIds) {
      try {
        await sendTelegramMessage(chatId, text, { parse_mode: "HTML" });
      } catch (err) {
        console.error(`[telegram-notifier] Failed to send status notification to ${chatId}:`, err);
      }
    }
    return true;
  } catch (err) {
    console.error("[telegram-notifier] Exception in notifyAdminStatusChange:", err);
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
    const targetChat = data.targetChatId?.trim() || process.env.NOTIFICATION_CHAT_ID || process.env.ADMIN_CHAT_ID || "-1004310551647";
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
      message: `ส่งข้อความทดสอบการแจ้งเตือน (HTML Mode) ไปยังห้องแชท Telegram ID "${chatIdNum}" สำเร็จแล้ว!`,
    };
  });

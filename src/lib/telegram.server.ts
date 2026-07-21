// Telegram Bot API calls through the Lovable connector gateway.
// Server-only.

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

function getTelegramKey(): string {
  const key = process.env.TELEGRAM_API_KEY || process.env.TELEGRAM_BOT_TOKEN;
  if (!key) throw new Error("Neither TELEGRAM_API_KEY nor TELEGRAM_BOT_TOKEN is configured");
  return key;
}

export async function telegramCall<T = unknown>(method: string, body: Record<string, unknown> = {}): Promise<T> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const telegramKey = getTelegramKey();

  let url: string;
  let headers: Record<string, string>;

  if (lovableKey) {
    url = `${GATEWAY_URL}/${method}`;
    headers = {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": telegramKey,
      "Content-Type": "application/json",
    };
  } else {
    url = `https://api.telegram.org/bot${telegramKey}/${method}`;
    headers = {
      "Content-Type": "application/json",
    };
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  if (!res.ok) {
    throw new Error(`Telegram ${method} failed [${res.status}]: ${text}`);
  }
  const data = parsed as { ok?: boolean; result?: T; description?: string };
  if (data && typeof data === "object" && data.ok === false) {
    throw new Error(`Telegram ${method} error: ${data.description ?? text}`);
  }
  return (data && typeof data === "object" && "result" in data ? data.result : (parsed as T)) as T;
}

export async function sendTelegramMessage(chatId: number | string, text: string, extra: Record<string, unknown> = {}) {
  return telegramCall<{ message_id: number }>("sendMessage", { chat_id: chatId, text, ...extra });
}

// Derive the webhook secret from the (stable) TELEGRAM_API_KEY or TELEGRAM_BOT_TOKEN so both the
// setWebhook call and the receiving route can compute the same value.
export async function deriveTelegramWebhookSecret(): Promise<string> {
  const key = getTelegramKey();
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(`telegram-webhook:${key}`));
  const b = new Uint8Array(digest);
  let bin = "";
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

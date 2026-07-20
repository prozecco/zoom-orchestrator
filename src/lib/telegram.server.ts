// Telegram Bot API calls through the Lovable connector gateway.
// Server-only.

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

function authHeaders(): Record<string, string> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const telegramKey = process.env.TELEGRAM_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
  if (!telegramKey) throw new Error("TELEGRAM_API_KEY is not configured");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": telegramKey,
    "Content-Type": "application/json",
  };
}

export async function telegramCall<T = unknown>(method: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${GATEWAY_URL}/${method}`, {
    method: "POST",
    headers: authHeaders(),
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

// Derive the webhook secret from the (stable) TELEGRAM_API_KEY so both the
// setWebhook call and the receiving route can compute the same value.
export async function deriveTelegramWebhookSecret(): Promise<string> {
  const key = process.env.TELEGRAM_API_KEY;
  if (!key) throw new Error("TELEGRAM_API_KEY is not configured");
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(`telegram-webhook:${key}`));
  const b = new Uint8Array(digest);
  let bin = "";
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

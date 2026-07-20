// Zoom Server-to-Server OAuth + Meetings API.
// Server-only: only import from *.functions.ts handlers or other .server.ts files.

type ZoomTokenCache = { token: string; expiresAt: number };
let cache: ZoomTokenCache | null = null;

export async function getZoomToken(custom?: { clientId?: string; clientSecret?: string; accountId?: string }): Promise<string> {
  const now = Date.now();
  if (!custom && cache && cache.expiresAt > now + 30_000) return cache.token;

  const clientId = (custom?.clientId || process.env.ZOOM_CLIENT_ID || "KJVgvj9TQHOT5oIBkl6Z7g").trim();
  const clientSecret = (custom?.clientSecret || process.env.ZOOM_CLIENT_SECRET || "z8S2uY85DqUFI2UdexFfd179MsBhcM6z").trim();
  const accountId = (custom?.accountId || process.env.ZOOM_ACCOUNT_ID || "Xmxl4CRXRLqrvr3WXlUqAw").trim();

  if (!clientId || !clientSecret || !accountId) {
    throw new Error(`Zoom credentials incomplete (ClientID: ${clientId ? "OK" : "MISSING"}, ClientSecret: ${clientSecret ? "OK" : "MISSING"}, AccountID: ${accountId ? "OK" : "MISSING"})`);
  }

  const basic = typeof Buffer !== "undefined"
    ? Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
    : btoa(`${clientId}:${clientSecret}`);

  const body = new URLSearchParams({
    grant_type: "account_credentials",
    account_id: accountId,
  });

  const res = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Zoom OAuth Authentication Failed [HTTP ${res.status}]: ${errBody}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  if (!custom) {
    cache = { token: data.access_token, expiresAt: now + data.expires_in * 1000 };
  }
  return data.access_token;
}

export async function testZoomOAuthConnection(custom?: { clientId?: string; clientSecret?: string; accountId?: string }): Promise<{ success: boolean; token: string; message: string }> {
  try {
    const token = await getZoomToken(custom);
    return {
      success: true,
      token,
      message: "Zoom Server-to-Server OAuth Token successfully issued!",
    };
  } catch (err: any) {
    return {
      success: false,
      token: "",
      message: err.message || "Unknown error during Zoom OAuth test",
    };
  }
}

async function zoomFetch(path: string, custom?: { clientId?: string; clientSecret?: string; accountId?: string }): Promise<Response> {
  const token = await getZoomToken(custom);
  return fetch(`https://api.zoom.us/v2${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export type ZoomMeeting = {
  id: number | string;
  topic: string;
  host_email?: string;
  start_time?: string;
  duration?: number;
  join_url?: string;
  password?: string;
  status?: string;
  raw?: unknown;
};

export async function fetchZoomMeeting(meetingId: string, custom?: { clientId?: string; clientSecret?: string; accountId?: string }): Promise<ZoomMeeting> {
  const res = await zoomFetch(`/meetings/${encodeURIComponent(meetingId)}`, custom);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoom getMeeting failed [${res.status}]: ${body}`);
  }
  const data = (await res.json()) as ZoomMeeting;
  return { ...data, raw: data };
}

export async function listUpcomingZoomMeetings(userId = "me", custom?: { clientId?: string; clientSecret?: string; accountId?: string }): Promise<ZoomMeeting[]> {
  const res = await zoomFetch(`/users/${encodeURIComponent(userId)}/meetings?type=upcoming&page_size=30`, custom);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoom listMeetings failed [${res.status}]: ${body}`);
  }
  const data = (await res.json()) as { meetings?: ZoomMeeting[] };
  return data.meetings ?? [];
}

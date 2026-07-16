// Zoom Server-to-Server OAuth + Meetings API.
// Server-only: only import from *.functions.ts handlers or other .server.ts files.

type ZoomTokenCache = { token: string; expiresAt: number };
let cache: ZoomTokenCache | null = null;

async function getZoomToken(): Promise<string> {
  const now = Date.now();
  if (cache && cache.expiresAt > now + 30_000) return cache.token;

  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  if (!clientId || !clientSecret || !accountId) {
    throw new Error("Zoom credentials are not configured");
  }
  const basic = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoom OAuth failed [${res.status}]: ${body}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cache = { token: data.access_token, expiresAt: now + data.expires_in * 1000 };
  return cache.token;
}

async function zoomFetch(path: string): Promise<Response> {
  const token = await getZoomToken();
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

export async function fetchZoomMeeting(meetingId: string): Promise<ZoomMeeting> {
  const res = await zoomFetch(`/meetings/${encodeURIComponent(meetingId)}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoom getMeeting failed [${res.status}]: ${body}`);
  }
  const data = (await res.json()) as ZoomMeeting;
  return { ...data, raw: data };
}

export async function listUpcomingZoomMeetings(userId = "me"): Promise<ZoomMeeting[]> {
  const res = await zoomFetch(`/users/${encodeURIComponent(userId)}/meetings?type=upcoming&page_size=30`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoom listMeetings failed [${res.status}]: ${body}`);
  }
  const data = (await res.json()) as { meetings?: ZoomMeeting[] };
  return data.meetings ?? [];
}

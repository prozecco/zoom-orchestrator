// Zoom Server-to-Server OAuth + Meetings API.
// Server-only: only import from *.functions.ts handlers or other .server.ts files.

type ZoomTokenCache = { 
  token: string; 
  expiresAt: number;
  clientId: string;
  clientSecret: string;
  accountId: string;
};
let cache: ZoomTokenCache | null = null;

export async function getZoomToken(custom?: { clientId?: string; clientSecret?: string; accountId?: string }): Promise<string> {
  const now = Date.now();

  let clientId = custom?.clientId?.trim();
  let clientSecret = custom?.clientSecret?.trim();
  let accountId = custom?.accountId?.trim();

  // Ignore mock placeholders or masked secrets to ensure fallback to process.env
  if (!clientId || clientId === "KJVgvj9TQHOT5oIBkl6Z7g") clientId = undefined;
  if (!clientSecret || clientSecret === "z8S2uY85DqUFI2UdexFfd179MsBhcM6z" || clientSecret.includes("...")) clientSecret = undefined;
  if (!accountId || accountId === "Xmxl4CRXRLqrvr3WXlUqAw") accountId = undefined;

  const finalClientId = (clientId || process.env.ZOOM_CLIENT_ID || "KJVgvj9TQHOT5oIBkl6Z7g").trim();
  const finalClientSecret = (clientSecret || process.env.ZOOM_CLIENT_SECRET || "z8S2uY85DqUFI2UdexFfd179MsBhcM6z").trim();
  const finalAccountId = (accountId || process.env.ZOOM_ACCOUNT_ID || "Xmxl4CRXRLqrvr3WXlUqAw").trim();

  // If cache is present and matches the requested credentials, reuse it
  if (
    cache &&
    cache.expiresAt > now + 30_000 &&
    cache.clientId === finalClientId &&
    cache.clientSecret === finalClientSecret &&
    cache.accountId === finalAccountId
  ) {
    return cache.token;
  }

  if (!finalClientId || !finalClientSecret || !finalAccountId) {
    throw new Error(`Zoom credentials incomplete (ClientID: ${finalClientId ? "OK" : "MISSING"}, ClientSecret: ${finalClientSecret ? "OK" : "MISSING"}, AccountID: ${finalAccountId ? "OK" : "MISSING"})`);
  }

  const basic = typeof Buffer !== "undefined"
    ? Buffer.from(`${finalClientId}:${finalClientSecret}`).toString("base64")
    : btoa(`${finalClientId}:${finalClientSecret}`);

  const body = new URLSearchParams({
    grant_type: "account_credentials",
    account_id: finalAccountId,
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
  cache = { 
    token: data.access_token, 
    expiresAt: now + data.expires_in * 1000,
    clientId: finalClientId,
    clientSecret: finalClientSecret,
    accountId: finalAccountId
  };
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

export type ZoomStandardQuestion = {
  field_name: string;
  required: boolean;
};

export type ZoomCustomQuestion = {
  title: string;
  type: 'short' | 'single';
  required: boolean;
  answers: string[];
};

export type ZoomRegistrationQuestions = {
  questions: ZoomStandardQuestion[];
  custom_questions: ZoomCustomQuestion[];
};

export async function fetchZoomRegistrationQuestions(
  meetingId: string,
  custom?: { clientId?: string; clientSecret?: string; accountId?: string }
): Promise<ZoomRegistrationQuestions> {
  const res = await zoomFetch(`/meetings/${encodeURIComponent(meetingId)}/registrants/questions`, custom);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoom getRegistrationQuestions failed [${res.status}]: ${body}`);
  }
  return (await res.json()) as ZoomRegistrationQuestions;
}

export type ZoomRegistrantPayload = {
  email: string;
  first_name: string;
  last_name?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  industry?: string;
  org?: string;
  job_title?: string;
  purchasing_time_frame?: string;
  role_in_purchase_process?: string;
  no_of_employees?: string;
  comments?: string;
  custom_questions?: Array<{ title: string; value: string }>;
};

export type ZoomRegistrantResponse = {
  registrant_id: string;
  id: number;
  topic: string;
  start_time: string;
  join_url: string;
};

export async function submitZoomRegistrant(
  meetingId: string,
  payload: ZoomRegistrantPayload,
  custom?: { clientId?: string; clientSecret?: string; accountId?: string }
): Promise<ZoomRegistrantResponse> {
  const token = await getZoomToken(custom);
  const res = await fetch(`https://api.zoom.us/v2/meetings/${encodeURIComponent(meetingId)}/registrants`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoom submitRegistrant failed [${res.status}]: ${body}`);
  }
  return (await res.json()) as ZoomRegistrantResponse;
}

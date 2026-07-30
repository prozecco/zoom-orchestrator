// Zoom Server-to-Server OAuth + Meetings API + Team Chat API.
// Server-only: only import from *.functions.ts handlers or other .server.ts files.

// ─── Types ───────────────────────────────────────────────────────────────────

export type ZoomMeeting = {
  id: string; // Zoom returns large numeric IDs as strings to prevent JS precision loss
  topic: string;
  host_email?: string;
  start_time?: string;
  duration?: number;
  join_url?: string;
  password?: string;
  status?: string;
  /** Original JSON response from the Zoom API */
  _raw?: Record<string, unknown>;
  raw?: unknown;
};

export type ZoomStandardQuestion = {
  field_name: string;
  required: boolean;
};

export type ZoomCustomQuestion = {
  title: string;
  type: "short" | "single";
  required: boolean;
  answers?: string[];
};

export type ZoomRegistrationQuestions = {
  questions: ZoomStandardQuestion[];
  custom_questions: ZoomCustomQuestion[];
};

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
  id: string;
  topic: string;
  start_time: string;
  join_url: string;
};

export type ZoomChatMessage = {
  id: string;
  message: string;
  sender?: string;
  date_time: string;
  timestamp?: number;
};

export type ZoomCredentials = {
  clientId: string;
  clientSecret: string;
  accountId: string;
};

type TokenCacheEntry = {
  token: string;
  expiresAt: number;
  credentials: ZoomCredentials;
};

// ─── Internal State ──────────────────────────────────────────────────────────

let cache: TokenCacheEntry | null = null;
let inflightPromise: Promise<string> | null = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveCredentials(
  custom?: Partial<ZoomCredentials>
): ZoomCredentials {
  let clientId = custom?.clientId?.trim();
  let clientSecret = custom?.clientSecret?.trim();
  let accountId = custom?.accountId?.trim();

  // Safely access process.env without throwing ReferenceError in non-Node environments
  const env = typeof process !== "undefined" && process.env ? process.env : {};

  // Ignore mock placeholders or masked secrets to ensure fallback to process.env or valid default
  if (!clientId || clientId === "KJVgvj9TQHOT5oIBkl6Z7g") clientId = undefined;
  if (!clientSecret || clientSecret === "z8S2uY85DqUFI2UdexFfd179MsBhcM6z" || clientSecret.includes("...")) clientSecret = undefined;
  if (!accountId || accountId === "Xmxl4CRXRLqrvr3WXlUqAw") accountId = undefined;

  const finalClientId = (clientId || env.ZOOM_CLIENT_ID || "o9qDabC6RPapF8IUgz3Efw").trim();
  const finalClientSecret = (clientSecret || env.ZOOM_CLIENT_SECRET || "4C06H56EsMmDjMShZVGwSs6SMOSZ5ztv").trim();
  const finalAccountId = (accountId || env.ZOOM_ACCOUNT_ID || "X0ADU72rToGb7hdnnIBkeg").trim();

  if (!finalClientId || !finalClientSecret || !finalAccountId) {
    const missing = [
      !finalClientId && "ZOOM_CLIENT_ID",
      !finalClientSecret && "ZOOM_CLIENT_SECRET",
      !finalAccountId && "ZOOM_ACCOUNT_ID",
    ].filter(Boolean);
    throw new Error(
      `Zoom credentials incomplete. Missing: ${missing.join(", ")}. ` +
      `Provide via arguments or environment variables.`
    );
  }

  return { clientId: finalClientId, clientSecret: finalClientSecret, accountId: finalAccountId };
}

function credentialsKey(c: ZoomCredentials): string {
  return `${c.clientId}:${c.clientSecret}:${c.accountId}`;
}

// ─── OAuth Token ─────────────────────────────────────────────────────────────

/**
 * Obtains a Zoom Server-to-Server OAuth token.
 * Caches tokens and handles concurrent requests with a single in-flight promise.
 */
export async function getZoomToken(
  custom?: Partial<ZoomCredentials>
): Promise<string> {
  const now = Date.now();
  const creds = resolveCredentials(custom);

  // Return cached token if valid for at least 60 seconds
  if (
    cache &&
    cache.expiresAt > now + 60_000 &&
    credentialsKey(cache.credentials) === credentialsKey(creds)
  ) {
    return cache.token;
  }

  // If another request is already fetching a token, wait for it (concurrency protection)
  if (inflightPromise) {
    return inflightPromise;
  }

  // Create the single OAuth request for all concurrent callers
  inflightPromise = fetchZoomToken(creds).finally(() => {
    inflightPromise = null;
  });

  return inflightPromise;
}

async function fetchZoomToken(creds: ZoomCredentials): Promise<string> {
  const basic = typeof Buffer !== "undefined"
    ? Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64")
    : btoa(`${creds.clientId}:${creds.clientSecret}`);

  const res = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "account_credentials",
      account_id: creds.accountId,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(
      `Zoom OAuth Authentication Failed [HTTP ${res.status}]: ${errBody}`
    );
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  const now = Date.now();

  cache = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
    credentials: creds,
  };

  return data.access_token;
}

/**
 * Test helper to verify OAuth connectivity.
 */
export async function testZoomOAuthConnection(
  custom?: Partial<ZoomCredentials>
): Promise<{ success: boolean; token: string; message: string }> {
  try {
    const token = await getZoomToken(custom);
    return {
      success: true,
      token,
      message: "Zoom Server-to-Server OAuth Token successfully issued!",
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, token: "", message };
  }
}

// ─── HTTP Helper ─────────────────────────────────────────────────────────────

async function zoomFetch(
  path: string,
  custom?: Partial<ZoomCredentials>,
  init?: RequestInit
): Promise<Response> {
  const token = await getZoomToken(custom);
  
  const headers = new Headers(init?.headers ?? {});
  headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  if (!headers.has("Content-Type") && init?.body && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`https://api.zoom.us/v2${path}`, {
    ...init,
    headers,
  });
}

// ─── Meetings API ────────────────────────────────────────────────────────────

/**
 * Fetch a single meeting by ID.
 */
export async function fetchZoomMeeting(
  meetingId: string | number,
  custom?: Partial<ZoomCredentials>
): Promise<ZoomMeeting> {
  if (!meetingId) throw new Error("meetingId is required");

  const res = await zoomFetch(`/meetings/${encodeURIComponent(String(meetingId))}`, custom);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`fetchZoomMeeting failed [${res.status}] for meeting ${meetingId}: ${body}`);
  }

  const raw = (await res.json()) as Record<string, unknown>;
  return { 
    id: String(raw.id ?? meetingId),
    topic: String(raw.topic ?? "Zoom Meeting"),
    host_email: raw.host_email as string | undefined,
    start_time: raw.start_time as string | undefined,
    duration: raw.duration as number | undefined,
    join_url: raw.join_url as string | undefined,
    password: (raw.password ?? raw.passcode) as string | undefined,
    status: raw.status as string | undefined,
    _raw: raw, 
    raw 
  };
}

/**
 * List upcoming meetings for a user.
 */
export async function listUpcomingZoomMeetings(
  userId = "me",
  custom?: Partial<ZoomCredentials>
): Promise<ZoomMeeting[]> {
  const res = await zoomFetch(
    `/users/${encodeURIComponent(userId)}/meetings?type=upcoming&page_size=30`,
    custom
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`listUpcomingZoomMeetings failed [${res.status}] for user ${userId}: ${body}`);
  }

  const data = (await res.json()) as { meetings?: Record<string, unknown>[] };
  return (data.meetings ?? []).map((m) => ({
    id: String(m.id ?? ""),
    topic: String(m.topic ?? "Zoom Meeting"),
    host_email: m.host_email as string | undefined,
    start_time: m.start_time as string | undefined,
    duration: m.duration as number | undefined,
    join_url: m.join_url as string | undefined,
    password: (m.password ?? m.passcode) as string | undefined,
    status: m.status as string | undefined,
    _raw: m,
    raw: m,
  }));
}

// ─── Registration API ────────────────────────────────────────────────────────

/**
 * Fetch registration questions configured for a meeting.
 */
export async function fetchZoomRegistrationQuestions(
  meetingId: string | number,
  custom?: Partial<ZoomCredentials>
): Promise<ZoomRegistrationQuestions> {
  if (!meetingId) throw new Error("meetingId is required");

  const res = await zoomFetch(
    `/meetings/${encodeURIComponent(String(meetingId))}/registrants/questions`,
    custom
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `fetchZoomRegistrationQuestions failed [${res.status}] for meeting ${meetingId}: ${body}`
    );
  }
  return (await res.json()) as ZoomRegistrationQuestions;
}

/**
 * List ALL registrants for a meeting filtered by status (approved, pending, denied).
 * Automatically paginates through all pages using next_page_token.
 */
export async function listZoomRegistrants(
  meetingId: string | number,
  status: "approved" | "pending" | "denied" = "approved",
  custom?: Partial<ZoomCredentials>
): Promise<any[]> {
  const allRegistrants: any[] = [];
  let nextPageToken = "";

  do {
    const queryPath = `/meetings/${encodeURIComponent(String(meetingId))}/registrants?status=${status}&page_size=300${
      nextPageToken ? `&next_page_token=${encodeURIComponent(nextPageToken)}` : ""
    }`;
    const res = await zoomFetch(queryPath, custom);
    if (!res.ok) {
      const body = await res.text();
      console.warn(`[zoom.server] listZoomRegistrants failed [${res.status}]: ${body}`);
      break;
    }
    const data = (await res.json()) as { registrants?: any[]; next_page_token?: string };
    if (data.registrants?.length) {
      allRegistrants.push(...data.registrants);
    }
    nextPageToken = data.next_page_token || "";
  } while (nextPageToken);

  return allRegistrants;
}

/**
 * List ALL live or past participants for a meeting (includes join/leave timestamps and duration).
 * Automatically paginates through all pages using next_page_token.
 */
export async function listZoomParticipants(
  meetingId: string | number,
  custom?: Partial<ZoomCredentials>
): Promise<{ total_records: number; participants: any[] }> {
  const allParticipants: any[] = [];
  let nextPageToken = "";
  let totalRecords = 0;

  do {
    const queryPath = `/past_meetings/${encodeURIComponent(String(meetingId))}/participants?page_size=300${
      nextPageToken ? `&next_page_token=${encodeURIComponent(nextPageToken)}` : ""
    }`;
    const res = await zoomFetch(queryPath, custom);
    if (!res.ok) {
      const body = await res.text();
      console.warn(`[zoom.server] listZoomParticipants failed [${res.status}]: ${body}`);
      break;
    }
    const data = (await res.json()) as { total_records?: number; participants?: any[]; next_page_token?: string };
    if (typeof data.total_records === "number" && data.total_records > 0) {
      totalRecords = data.total_records;
    }
    if (data.participants?.length) {
      allParticipants.push(...data.participants);
    }
    nextPageToken = data.next_page_token || "";
  } while (nextPageToken);

  return {
    total_records: totalRecords || allParticipants.length,
    participants: allParticipants,
  };
}

/**
 * Register a participant for a meeting.
 */
export async function submitZoomRegistrant(
  meetingId: string | number,
  payload: ZoomRegistrantPayload,
  custom?: Partial<ZoomCredentials>
): Promise<ZoomRegistrantResponse> {
  if (!meetingId) throw new Error("meetingId is required");
  if (!payload?.email) throw new Error("Registrant email is required");
  if (!payload?.first_name) throw new Error("Registrant first_name is required");

  const res = await zoomFetch(
    `/meetings/${encodeURIComponent(String(meetingId))}/registrants`,
    custom,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `submitZoomRegistrant failed [${res.status}] for meeting ${meetingId}: ${body}`
    );
  }
  const data = (await res.json()) as Record<string, unknown>;
  return {
    registrant_id: String(data.registrant_id ?? data.id ?? ""),
    id: String(data.id ?? meetingId),
    topic: String(data.topic ?? ""),
    start_time: String(data.start_time ?? ""),
    join_url: String(data.join_url ?? ""),
  };
}

/**
 * Update registrant status on Zoom API (approve, deny, cancel).
 */
export async function updateZoomRegistrantStatus(
  meetingId: string | number,
  action: "approve" | "deny" | "cancel",
  registrants: Array<{ email: string; id?: string }>,
  custom?: Partial<ZoomCredentials>
): Promise<boolean> {
  if (!meetingId || !registrants.length) return false;

  const res = await zoomFetch(
    `/meetings/${encodeURIComponent(String(meetingId))}/registrants/status`,
    custom,
    {
      method: "PUT",
      body: JSON.stringify({
        action,
        registrants: registrants.map((r) => ({
          email: r.email,
          ...(r.id ? { id: r.id } : {}),
        })),
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    console.warn(`[zoom.server] updateZoomRegistrantStatus failed [${res.status}]: ${errText}`);
    return false;
  }
  return true;
}

// ─── Team Chat API ───────────────────────────────────────────────────────────

/**
 * Send a 1:1 direct message via Zoom Team Chat.
 * Requires scope: `team_chat:write:user_message:admin`
 */
export async function sendZoomDirectMessage(
  toContactEmail: string,
  messageText: string,
  custom?: Partial<ZoomCredentials>
): Promise<{ id: string; date_time: string }> {
  if (!toContactEmail || !toContactEmail.includes("@")) {
    throw new Error("Invalid toContactEmail: must be a valid email address");
  }
  if (!messageText || !messageText.trim()) {
    throw new Error("messageText is required");
  }

  const res = await zoomFetch(
    "/chat/users/me/messages",
    custom,
    {
      method: "POST",
      body: JSON.stringify({
        to_contact: toContactEmail,
        message: messageText,
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `sendZoomDirectMessage failed [${res.status}] to ${toContactEmail}: ${errText}`
    );
  }

  const data = (await res.json()) as Record<string, unknown>;
  return {
    id: String(data.id ?? ""),
    date_time: String(data.date_time ?? new Date().toISOString()),
  };
}

/**
 * Fetch 1:1 direct message history.
 * Requires scope: `team_chat:read:user_message:admin`
 */
export async function listZoomDirectMessages(
  toContactEmail: string,
  custom?: Partial<ZoomCredentials>
): Promise<ZoomChatMessage[]> {
  if (!toContactEmail || !toContactEmail.includes("@")) {
    throw new Error("Invalid toContactEmail: must be a valid email address");
  }

  const res = await zoomFetch(
    `/chat/users/me/messages?to_contact=${encodeURIComponent(toContactEmail)}&page_size=50`,
    custom
  );

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[zoom.server] listZoomDirectMessages failed [${res.status}] for ${toContactEmail}: ${errText}`);
    return [];
  }

  const data = (await res.json()) as { messages?: Record<string, unknown>[] };
  return (data.messages ?? []).map((m) => ({
    id: String(m.id ?? ""),
    message: String(m.message ?? ""),
    sender: String(m.sender ?? ""),
    date_time: String(m.date_time ?? new Date().toISOString()),
    timestamp: typeof m.timestamp === "number" ? m.timestamp : Date.now(),
  }));
}

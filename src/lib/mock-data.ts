export type NameAlias = {
  oldName: string;
  newName: string;
  changedAt: string;
};

export type Registrant = {
  id: string;
  name: string;
  telegramUser: string;
  email: string;
  phone: string;
  countryCode: string;
  countryFlag: string;
  status: "pending" | "approved" | "rejected" | "attended" | "denied" | "blacklisted" | "cancelled";
  source: "telegram_miniapp" | "zoom_web";
  registeredAt: string;
  aliasHistory?: NameAlias[];
};

export type ScheduleItem = {
  id: string;
  title: string;
  startsAt: string;
  durationMin: number;
  host: string;
  zoomMeetingId: string;
};

export type AuditEntry = {
  id: string;
  actor: string;
  action: string;
  target: string;
  at: string;
};

export type ChatMessage = {
  id: string;
  from: string;
  role: "host" | "attendee";
  text: string;
  at: string;
};

export const activeMeeting = {
  id: "83483016779",
  topic: "Weekly Strategy Sync",
  host: "Elena Ross",
  hostEmail: "elena@company.io",
  startTime: "2026-07-14T15:00:00Z",
  durationMin: 60,
  passcode: "482910",
  joinUrl: "https://zoom.us/j/83483016779",
  status: "live" as "live" | "scheduled" | "ended",
  attendees: 42,
  capacity: 100,
};

export const schedule: ScheduleItem[] = [
  { id: "m1", title: "Weekly Strategy Sync", startsAt: "2026-07-14T15:00:00Z", durationMin: 60, host: "Elena Ross", zoomMeetingId: "83483016779" },
  { id: "m2", title: "Product Roadmap Review", startsAt: "2026-07-15T17:00:00Z", durationMin: 45, host: "Marcus Chen", zoomMeetingId: "84920011234" },
  { id: "m3", title: "Customer Onboarding Q3", startsAt: "2026-07-16T13:30:00Z", durationMin: 90, host: "Priya Natarajan", zoomMeetingId: "85512309981" },
  { id: "m4", title: "Engineering All-Hands", startsAt: "2026-07-18T16:00:00Z", durationMin: 60, host: "Elena Ross", zoomMeetingId: "86601122334" },
];

export const registrants: Registrant[] = [
  { 
    id: "r1", 
    name: "Alice Johnson", 
    telegramUser: "@alicej", 
    email: "alice@example.com", 
    phone: "+1 555-0101", 
    countryCode: "US", 
    countryFlag: "🇺🇸", 
    status: "approved", 
    source: "telegram_miniapp",
    registeredAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45m ago
    aliasHistory: [
      { oldName: "Alice J.", newName: "Alice Johnson", changedAt: "2026-07-13T10:15:00Z" }
    ]
  },
  { 
    id: "r2", 
    name: "Bruno Silva", 
    telegramUser: "@brunos", 
    email: "bruno@example.com", 
    phone: "+55 11 91234-5678", 
    countryCode: "BR", 
    countryFlag: "🇧🇷", 
    status: "attended", 
    source: "zoom_web",
    registeredAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(), // 3h ago
  },
  { 
    id: "r3", 
    name: "Chika Adeyemi", 
    telegramUser: "@chikaa", 
    email: "chika@example.com", 
    phone: "+234 802 111 2233", 
    countryCode: "NG", 
    countryFlag: "🇳🇬", 
    status: "pending", 
    source: "telegram_miniapp",
    registeredAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(), // 5h ago
  },
  { 
    id: "r4", 
    name: "Dmitri Volkov", 
    telegramUser: "@dmitriv", 
    email: "dmitri@example.com", 
    phone: "+7 999 555 4433", 
    countryCode: "RU", 
    countryFlag: "🇷🇺", 
    status: "pending", 
    source: "zoom_web",
    registeredAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(), // 2d ago
    aliasHistory: [
      { oldName: "Dmitri V.", newName: "D. Volkov", changedAt: "2026-07-14T09:05:00Z" },
      { oldName: "D. Volkov", newName: "Dmitri Volkov", changedAt: "2026-07-14T09:10:00Z" }
    ]
  },
  { 
    id: "r5", 
    name: "Emiko Tanaka", 
    telegramUser: "@emikot", 
    email: "emiko@example.com", 
    phone: "+81 90 1234 5678", 
    countryCode: "JP", 
    countryFlag: "🇯🇵", 
    status: "denied", 
    source: "zoom_web",
    registeredAt: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(), // 20d ago (>15d)
  },
  { 
    id: "r6", 
    name: "Farouk Mensah", 
    telegramUser: "@faroukm", 
    email: "farouk@example.com", 
    phone: "+233 24 555 7788", 
    countryCode: "GH", 
    countryFlag: "🇬🇭", 
    status: "approved", 
    source: "telegram_miniapp",
    registeredAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(), // 1h ago
  },
  { 
    id: "r7", 
    name: "Somsak Jaidee", 
    telegramUser: "@somsak_th", 
    email: "somsak@example.co.th", 
    phone: "+66 81 234 5678", 
    countryCode: "TH", 
    countryFlag: "🇹🇭", 
    status: "pending", 
    source: "telegram_miniapp",
    registeredAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15m ago
  },
  { 
    id: "r8", 
    name: "Chao Joshua", 
    telegramUser: "@aiwenzheng", 
    email: "aiwenzheng740@gmail.com", 
    phone: "+86 138 0000 0000", 
    countryCode: "CN", 
    countryFlag: "🇨🇳", 
    status: "blacklisted", 
    source: "zoom_web",
    registeredAt: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString(), // 25d ago (>15d)
  },
];

export const auditLog: AuditEntry[] = [
  { id: "a1", actor: "Elena Ross", action: "Approved registrant", target: "Alice Johnson", at: "2026-07-14T10:15:00Z" },
  { id: "a2", actor: "System", action: "Meeting started", target: "83483016779", at: "2026-07-14T15:00:03Z" },
  { id: "a3", actor: "Marcus Chen", action: "Updated meeting", target: "Product Roadmap Review", at: "2026-07-13T22:41:00Z" },
  { id: "a4", actor: "Elena Ross", action: "Rejected registrant", target: "Emiko Tanaka", at: "2026-07-13T19:02:00Z" },
  { id: "a5", actor: "System", action: "Broadcast sent", target: "All approved (2)", at: "2026-07-14T14:45:00Z" },
];

export const chatMessages: ChatMessage[] = [
  { id: "c1", from: "Elena Ross", role: "host", text: "Welcome everyone! We'll start in 2 minutes.", at: "2026-07-14T14:58:10Z" },
  { id: "c2", from: "Alice Johnson", role: "attendee", text: "Excited to be here 👋", at: "2026-07-14T14:58:45Z" },
  { id: "c3", from: "Bruno Silva", role: "attendee", text: "Audio is clear on my end.", at: "2026-07-14T14:59:20Z" },
  { id: "c4", from: "Elena Ross", role: "host", text: "Great — kicking off now.", at: "2026-07-14T15:00:05Z" },
];

export const stats = {
  totalMeetings: 128,
  upcomingMeetings: 4,
  registrantsThisWeek: 87,
  liveNow: 1,
};

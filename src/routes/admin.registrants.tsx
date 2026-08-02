import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RegistrantProfileSheet } from "@/components/admin/RegistrantProfile";
import { MemberIdConfigDialog } from "@/components/admin/MemberIdConfigDialog";
import { AttendanceManagementSheet } from "@/components/admin/AttendanceManagementSheet";
import type { Registrant } from "@/lib/mock-data";
import { updateRegistrantStatus, bulkUpdateStatus } from "@/lib/registrants.functions";
import { getActiveMeeting } from "@/lib/meetings.functions";
import { formatBangkokRegistrationTime } from "@/lib/time-formatter";
import { Search, Hash, Clock, Smartphone, Globe, Check, X, CheckCircle2, UserCheck, UserX, Users, RefreshCw, Radio, PauseCircle } from "lucide-react";
import { syncLiveZoomData } from "@/lib/meetings.functions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTelegramViewer } from "@/hooks/useTelegramViewer";
import { useRealtimeRegistrants } from "@/hooks/useRealtimeRegistrants";

export const Route = createFileRoute("/admin/registrants")({
  ssr: false,
  component: RegistrantsPage,
});

// ─── Status Colors ─────────────────────────────────────────────────────────
const statusColor: Record<string, string> = {
  pending:     "bg-amber-500/15 text-amber-600 border-amber-500/30",
  on_hold:     "bg-violet-500/15 text-violet-600 border-violet-500/30",
  approved:    "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  attended:    "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  rejected:    "bg-rose-500/15 text-rose-600 border-rose-500/30",
  denied:      "bg-rose-500/15 text-rose-600 border-rose-500/30",
  cancelled:   "bg-slate-500/15 text-slate-600 border-slate-500/30",
  blacklisted: "bg-rose-950/40 text-rose-700 border-rose-600/40",
};

// ─── Filter Chips ──────────────────────────────────────────────────────────
const filterChips = [
  {
    id: "all-pending",
    label: "Pending",
    icon: Clock,
    activeStyle: "bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/25",
    filter: (r: Registrant) => r.status === "pending",
  },
  {
    id: "new",
    label: "New ≤3d",
    icon: CheckCircle2,
    activeStyle: "bg-sky-500 text-white border-sky-500 shadow-md shadow-sky-500/25",
    filter: (r: Registrant) =>
      new Date(r.registeredAt) >= new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    id: "on-hold",
    label: "On Hold",
    icon: PauseCircle,
    activeStyle: "bg-violet-500 text-white border-violet-500 shadow-md shadow-violet-500/25",
    filter: (r: Registrant) => r.status === "on_hold",
  },
  {
    id: "approved",
    label: "Approved",
    icon: CheckCircle2,
    activeStyle: "bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/25",
    filter: (r: Registrant) => r.status === "approved" || r.status === "attended",
  },
  {
    id: "denied",
    label: "Denied",
    icon: X,
    activeStyle: "bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-500/25",
    filter: (r: Registrant) =>
      r.status === "denied" || r.status === "rejected" || r.status === "blacklisted",
  },
  {
    id: "all",
    label: "All",
    icon: Users,
    activeStyle: "bg-slate-700 text-white border-slate-600 shadow-md",
    filter: () => true,
  },
];

function RegistrantsPage() {
  const getActive = useServerFn(getActiveMeeting);
  const updateStatusFn = useServerFn(updateRegistrantStatus);
  const bulkUpdateStatusFn = useServerFn(bulkUpdateStatus);
  const syncLiveFn = useServerFn(syncLiveZoomData);

  const { telegramId } = useTelegramViewer();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [activeFilter, setActiveFilter] = useState("all-pending");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedRegistrant, setSelectedRegistrant] = useState<Registrant | null>(null);
  const [activeMeetingOnly, setActiveMeetingOnly] = useState(true);

  // Realtime hook
  const {
    data: registrantsData,
    isLoading,
    isLive,
    connectionStatus,
    lastEvent,
  } = useRealtimeRegistrants();

  // Active meeting (light polling)
  const activeMeetingQuery = useQuery({
    queryKey: ["active-meeting"],
    queryFn: () => getActive(),
    refetchInterval: 30000,
  });
  const activeMeeting = activeMeetingQuery.data;

  // ─── Mutations ────────────────────────────────────────────────────────────
  const liveSyncMutation = useMutation({
    mutationFn: () => syncLiveFn({ data: {} }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["registrants"] });
      qc.invalidateQueries({ queryKey: ["active-meeting"] });
      toast.success(
        `Synced! Approved: ${data.approved_registrants_count}, Pending: ${data.pending_registrants_count}`
      );
    },
    onError: (err: any) => toast.error(`Sync failed: ${err.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: (params: { id: string; status: "approved" | "denied" | "pending" | "on_hold" }) =>
      updateStatusFn({ data: params }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["registrants"] });
      toast.success(vars.status === "approved" ? "Approved ✅" : "Denied ❌");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const bulkMutation = useMutation({
    mutationFn: (params: { ids: string[]; status: "approved" | "denied" }) =>
      bulkUpdateStatusFn({ data: params }),
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ["registrants"] });
      setSelectedIds(new Set());
      toast.success(`${vars.status === "approved" ? "Approved" : "Denied"} ${res.updated} users`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  // ─── Data Mapping (FIXED: correct source detection) ──────────────────────
  /**
   * SOURCE DETECTION LOGIC (CORRECTED):
   * 
   * telegram_id  → comes from Telegram Mini App initDataUnsafe.user.id (number)
   * telegram_user → comes from custom question in registration form (user-typed)
   * 
   * Therefore:
   * - telegram_id IS NOT NULL  → Source: Telegram Mini App (100% certain)
   * - telegram_id IS NULL      → Source: Zoom Web Portal (even if telegram_user exists)
   * 
   * Why? Because Zoom Web Portal users can type any @username in custom questions,
   * but only Mini App users have their actual telegram_id from Telegram API.
   */
  const allLive: (Registrant & { meeting_id: string | null })[] =
    (registrantsData ?? []).map((dbR: any) => {
      // CORRECT: Check telegram_id (numeric ID from Telegram API), not telegram_user
      const hasTelegramId = dbR.telegram_id != null && dbR.telegram_id !== 0;

      // Source is determined by telegram_id presence
      const source = hasTelegramId ? "telegram_miniapp" : "zoom_web";

      // telegram_user may exist from custom question for BOTH sources
      const telegramUser = dbR.telegram_user
        ? `@${dbR.telegram_user.replace(/^@/, "")}`
        : hasTelegramId
        ? `@user_${dbR.telegram_id}`
        : "—";

      return {
        id: dbR.id,
        name: dbR.name || "Unknown",
        telegramUser,
        email: dbR.email || "—",
        phone: dbR.phone ?? "",
        status: (dbR.status as Registrant["status"]) || "pending",
        countryCode: "TH",
        countryFlag: "🇹🇭",
        registeredAt: dbR.registered_at,
        source, // "telegram_miniapp" or "zoom_web"
        meeting_id: dbR.meeting_id,
      };
    });

  const registrantsList =
    activeMeetingOnly && activeMeeting
      ? allLive.filter(
          (r) =>
            !r.meeting_id ||
            r.meeting_id === activeMeeting.id ||
            r.meeting_id === activeMeeting.zoom_id
        )
      : allLive;

  // ─── Filter & Search ──────────────────────────────────────────────────────
  const filtered = registrantsList.filter((r) => {
    const matchesSearch = [r.name, r.telegramUser, r.email, r.countryCode].some((f) =>
      f.toLowerCase().includes(q.toLowerCase())
    );
    const activeFilterFn =
      filterChips.find((f) => f.id === activeFilter)?.filter || (() => true);
    return matchesSearch && activeFilterFn(r);
  });

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((r) => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const counts = {
    total: registrantsList.length,
    pending: registrantsList.filter((r) => r.status === "pending").length,
    onHold: registrantsList.filter((r) => r.status === "on_hold").length,
    approved: registrantsList.filter((r) => r.status === "approved" || r.status === "attended").length,
    denied: registrantsList.filter((r) => r.status === "denied" || r.status === "rejected" || r.status === "blacklisted").length,
  };

  const handleQuickApprove = (id: string) => updateMutation.mutate({ id, status: "approved" });
  const handleQuickDeny = (id: string) => updateMutation.mutate({ id, status: "denied" });
  const handleQuickOnHold = (id: string) => updateMutation.mutate({ id, status: "on_hold" });

  // ─── Modals ───────────────────────────────────────────────────────────────
  const [memberIdConfigOpen, setMemberIdConfigOpen] = useState(false);
  const [attendanceSheetOpen, setAttendanceSheetOpen] = useState(false);

  return (
    <div className="space-y-4 pb-24 max-w-6xl mx-auto px-3 sm:px-4">
      {/* ─── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-emerald-500" />
          <h1 className="text-lg font-bold">Users Management</h1>
          {isLive ? (
            <Badge
              variant="outline"
              className="text-[10px] border-emerald-400 text-emerald-600 bg-emerald-50 flex items-center gap-1 animate-pulse"
            >
              <Radio className="h-2.5 w-2.5" /> LIVE
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-[10px] border-amber-400 text-amber-600 bg-amber-50 flex items-center gap-1"
            >
              <RefreshCw className="h-2.5 w-2.5" /> {connectionStatus}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => liveSyncMutation.mutate()}
            disabled={liveSyncMutation.isPending}
            className="text-xs border-emerald-500/40 text-emerald-600 hover:bg-emerald-50 h-8"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1", liveSyncMutation.isPending && "animate-spin")} />
            {liveSyncMutation.isPending ? "Syncing..." : "Sync Live Zoom"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMemberIdConfigOpen(true)}
            className="text-xs border-primary/40 text-primary hover:bg-primary/5 h-8"
          >
            <Hash className="h-3.5 w-3.5 mr-1" /> Member ID
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAttendanceSheetOpen(true)}
            className="text-xs border-emerald-500/40 text-emerald-600 hover:bg-emerald-50 h-8"
          >
            <Clock className="h-3.5 w-3.5 mr-1" /> Attendance
          </Button>
        </div>
      </div>

      {/* ─── Debug Info ────────────────────────────────────────────────────── */}
      {lastEvent && (
        <div className="text-[10px] text-muted-foreground font-mono bg-muted/30 px-2 py-1 rounded">
          Last event: {lastEvent} | Total: {counts.total} | Connection: {connectionStatus}
        </div>
      )}

      {/* ─── Active Meeting & Stats ────────────────────────────────────────── */}
      <Card className="border border-border/40 shadow-sm">
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/30 pb-3">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span className="text-sm font-bold truncate">
                {activeMeeting?.topic || "ＳＵＮＣＬＯＵＤＳ １７６６"}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                #{activeMeeting?.zoom_id || "85651598189"}
              </span>
            </div>
            <Button
              size="sm"
              variant={activeMeetingOnly ? "default" : "outline"}
              onClick={() => setActiveMeetingOnly((v) => !v)}
              className="text-[11px] h-7 px-3 shrink-0"
            >
              {activeMeetingOnly ? "Active Meeting Only" : "All Meetings"}
            </Button>
          </div>

          <div className="grid grid-cols-5 gap-2">
            <StatPill label="Total" value={counts.total} color="blue" />
            <StatPill label="Pending" value={counts.pending} color="amber" />
            <StatPill label="On Hold" value={counts.onHold} color="violet" />
            <StatPill label="Approved" value={counts.approved} color="emerald" />
            <StatPill label="Denied" value={counts.denied} color="rose" />
          </div>
        </CardContent>
      </Card>

      {/* ─── Search & Filters ──────────────────────────────────────────────── */}
      <Card className="border border-border/40 shadow-sm">
        <CardHeader className="pb-3 border-b border-border/30 space-y-3 p-3 sm:p-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="w-full pl-9 bg-background border-border/40 text-sm h-9"
              placeholder="Search by name, email, @username..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {filterChips.map((chip) => {
              const isActive = activeFilter === chip.id;
              const ChipIcon = chip.icon;
              return (
                <button
                  key={chip.id}
                  onClick={() => setActiveFilter(chip.id)}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full transition-all border",
                    isActive
                      ? chip.activeStyle
                      : "bg-muted/30 border-border/30 text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <ChipIcon className="h-3 w-3" />
                  {chip.label}
                  {chip.id === "all-pending" && counts.pending > 0 && (
                    <span className="ml-0.5">({counts.pending})</span>
                  )}
                </button>
              );
            })}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="flex items-center justify-between p-3 border-b border-border/30 bg-muted/20 text-xs">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedIds.size > 0 && selectedIds.size === filtered.length && filtered.length > 0}
                onCheckedChange={toggleSelectAll}
                className="h-4 w-4"
              />
              <span className="font-medium text-muted-foreground">Select All</span>
            </div>
            <span className="text-muted-foreground">{filtered.length} users</span>
          </div>

          <div className="divide-y divide-border/30">
            {filtered.map((r) => (
              <div
                key={r.id}
                className="flex items-start gap-3 p-3 sm:p-4 hover:bg-muted/10 transition-colors cursor-pointer group"
                onClick={() => setSelectedRegistrant(r)}
              >
                <div onClick={(e) => e.stopPropagation()} className="pt-1">
                  <Checkbox
                    checked={selectedIds.has(r.id)}
                    onCheckedChange={() => toggleSelect(r.id)}
                    className="h-4 w-4"
                  />
                </div>

                <Avatar className="h-9 w-9 bg-primary/10 text-primary font-bold shrink-0 mt-0.5">
                  <AvatarFallback>{r.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{r.name}</span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1 font-mono bg-muted/30 border-border/40">
                      {r.countryCode} {r.countryFlag}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{r.email}</span>
                    <span>·</span>
                    <span className="font-mono text-sky-500">{r.telegramUser}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <Badge
                      className={cn(
                        "text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full",
                        statusColor[r.status]
                      )}
                    >
                      {r.status}
                    </Badge>

                    {/* Source Badge (FIXED: based on telegram_id, not telegram_user) */}
                    {r.source === "telegram_miniapp" ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0.5 border-sky-400/40 text-sky-600 bg-sky-50 flex items-center gap-1"
                      >
                        <Smartphone className="h-3 w-3" /> Telegram Mini App
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0.5 border-blue-400/40 text-blue-600 bg-blue-50 flex items-center gap-1"
                      >
                        <Globe className="h-3 w-3" /> Zoom Web Portal
                      </Badge>
                    )}

                    <span
                      className="text-[10px] text-muted-foreground font-mono flex items-center gap-1"
                      title={new Date(r.registeredAt).toLocaleString()}
                    >
                      <Clock className="h-3 w-3 opacity-50" />
                      {formatBangkokRegistrationTime(r.registeredAt)}
                    </span>
                  </div>
                </div>

                <div
                  className="flex items-center gap-1 shrink-0 pt-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    size="sm"
                    disabled={updateMutation.isPending}
                    onClick={() => handleQuickApprove(r.id)}
                    className="h-7 w-7 p-0 rounded-full bg-emerald-100 hover:bg-emerald-500 text-emerald-600 hover:text-white border border-emerald-300 transition-all"
                    title="Approve"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    disabled={updateMutation.isPending}
                    onClick={() => handleQuickOnHold(r.id)}
                    className="h-7 w-7 p-0 rounded-full bg-violet-100 hover:bg-violet-500 text-violet-600 hover:text-white border border-violet-300 transition-all"
                    title="On Hold"
                  >
                    <PauseCircle className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    disabled={updateMutation.isPending}
                    onClick={() => handleQuickDeny(r.id)}
                    className="h-7 w-7 p-0 rounded-full bg-rose-100 hover:bg-rose-500 text-rose-600 hover:text-white border border-rose-300 transition-all"
                    title="Deny"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">
                {isLoading ? "Loading registrants..." : "No users found."}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── Floating Bulk Actions ──────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900/95 border border-primary/30 px-5 py-3 rounded-full shadow-2xl backdrop-blur-md">
          <span className="text-xs font-semibold text-white">
            {selectedIds.size} selected
          </span>
          <Button
            size="sm"
            disabled={bulkMutation.isPending}
            onClick={() => bulkMutation.mutate({ ids: Array.from(selectedIds), status: "approved" })}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 rounded-full gap-1.5"
          >
            <UserCheck className="h-3.5 w-3.5" /> Approve
          </Button>
          <Button
            size="sm"
            disabled={bulkMutation.isPending}
            onClick={() => bulkMutation.mutate({ ids: Array.from(selectedIds), status: "denied" })}
            className="bg-rose-600 hover:bg-rose-500 text-white text-xs h-8 rounded-full gap-1.5"
          >
            <UserX className="h-3.5 w-3.5" /> Deny
          </Button>
        </div>
      )}

      {/* ─── Modals ─────────────────────────────────────────────────────────── */}
      <RegistrantProfileSheet
        registrant={selectedRegistrant}
        open={!!selectedRegistrant}
        onOpenChange={(isOpen) => !isOpen && setSelectedRegistrant(null)}
      />
      <MemberIdConfigDialog open={memberIdConfigOpen} onOpenChange={setMemberIdConfigOpen} />
      <AttendanceManagementSheet open={attendanceSheetOpen} onOpenChange={setAttendanceSheetOpen} />
    </div>
  );
}

// ─── StatPill Component ────────────────────────────────────────────────────
function StatPill({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "blue" | "amber" | "violet" | "emerald" | "rose";
}) {
  const colorMap = {
    blue:    "bg-blue-50 border-blue-200 text-blue-700",
    amber:   "bg-amber-50 border-amber-200 text-amber-700",
    violet:  "bg-violet-50 border-violet-200 text-violet-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    rose:    "bg-rose-50 border-rose-200 text-rose-700",
  };

  return (
    <div className={cn("flex flex-col items-center justify-center py-2 px-1 rounded-lg border", colorMap[color])}>
      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{label}</span>
      <span className="text-lg font-bold leading-tight">{value}</span>
    </div>
  );
}

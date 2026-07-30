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
import { listRegistrants, updateRegistrantStatus, bulkUpdateStatus } from "@/lib/registrants.functions";
import { getActiveMeeting } from "@/lib/meetings.functions";
import { formatBangkokRegistrationTime } from "@/lib/time-formatter";
import { Search, Hash, Clock, Smartphone, Globe, Check, X, AlertTriangle, CheckCircle2, UserCheck, UserX, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTelegramViewer } from "@/hooks/useTelegramViewer";

export const Route = createFileRoute("/admin/registrants")({
  ssr: false,
  component: RegistrantsPage,
});

// Unified Vibrant Status Colors for User Cards & Badges
const statusColor: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold",
  on_hold: "bg-violet-500/20 text-violet-300 border border-violet-500/40 font-bold",
  approved: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold",
  attended: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold",
  rejected: "bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold",
  denied: "bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold",
  cancelled: "bg-slate-500/20 text-slate-300 border border-slate-500/40 font-bold",
  blacklisted: "bg-rose-950/60 text-rose-400 border border-rose-600/60 font-bold",
};

// Vibrant Filter Chips with Status Color Matching
const filterChips = [
  { 
    id: "all-pending", 
    label: "All Pending", 
    activeStyle: "bg-amber-500/25 border-amber-500 text-amber-300 font-bold shadow-md shadow-amber-500/20",
    filter: (r: Registrant) => r.status === "pending" 
  },
  { 
    id: "new", 
    label: "New (≤3d)", 
    activeStyle: "bg-sky-500/25 border-sky-500 text-sky-300 font-bold shadow-md shadow-sky-500/20",
    filter: (r: Registrant) => new Date(r.registeredAt) >= new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) 
  },
  { 
    id: "on-hold", 
    label: "On Hold (>3d)", 
    activeStyle: "bg-violet-500/25 border-violet-500 text-violet-300 font-bold shadow-md shadow-violet-500/20",
    filter: (r: Registrant) => r.status === "pending" && new Date(r.registeredAt) < new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) 
  },
  { 
    id: "approved", 
    label: "Approved", 
    activeStyle: "bg-emerald-500/25 border-emerald-500 text-emerald-300 font-bold shadow-md shadow-emerald-500/20",
    filter: (r: Registrant) => r.status === "approved" || r.status === "attended" 
  },
  { 
    id: "denied", 
    label: "Denied", 
    activeStyle: "bg-rose-500/25 border-rose-500 text-rose-300 font-bold shadow-md shadow-rose-500/20",
    filter: (r: Registrant) => r.status === "denied" || r.status === "rejected" || r.status === "blacklisted" 
  },
  { 
    id: "all", 
    label: "All Users", 
    activeStyle: "bg-slate-700/60 border-slate-400 text-white font-bold shadow-md",
    filter: () => true 
  },
];

function RegistrantsPage() {
  const listRegs = useServerFn(listRegistrants);
  const getActive = useServerFn(getActiveMeeting);
  const updateStatusFn = useServerFn(updateRegistrantStatus);
  const bulkUpdateStatusFn = useServerFn(bulkUpdateStatus);
  
  const { telegramId } = useTelegramViewer();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [activeFilter, setActiveFilter] = useState("all-pending");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedRegistrant, setSelectedRegistrant] = useState<Registrant | null>(null);
  const [activeMeetingOnly, setActiveMeetingOnly] = useState(true);

  const registrantsQuery = useQuery({ queryKey: ["registrants"], queryFn: () => listRegs(), refetchInterval: 5000 });
  const activeMeetingQuery = useQuery({ queryKey: ["active-meeting"], queryFn: () => getActive(), refetchInterval: 15000 });
  const activeMeeting = activeMeetingQuery.data;

  // Single approval/denial mutation
  const updateMutation = useMutation({
    mutationFn: (params: { id: string; status: "approved" | "denied" | "pending" | "on_hold" }) =>
      updateStatusFn({ data: params }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["registrants"] });
      qc.invalidateQueries({ queryKey: ["approvedRegistrants"] });
      toast.success(
        variables.status === "approved"
          ? "อนุมัติผู้ใช้เรียบร้อยแล้ว ✅"
          : "ปฏิเสธการลงทะเบียนเรียบร้อย ❌"
      );
    },
    onError: (err: any) => {
      toast.error(`เกิดข้อผิดพลาด: ${err.message}`);
    },
  });

  // Bulk approval/denial mutation
  const bulkMutation = useMutation({
    mutationFn: (params: { ids: string[]; status: "approved" | "denied" }) =>
      bulkUpdateStatusFn({ data: params }),
    onSuccess: (res, variables) => {
      qc.invalidateQueries({ queryKey: ["registrants"] });
      qc.invalidateQueries({ queryKey: ["approvedRegistrants"] });
      setSelectedIds(new Set());
      toast.success(
        variables.status === "approved"
          ? `อนุมัติผู้ใช้ทั้ง ${res.updated} คนเรียบร้อยแล้ว ✅`
          : `ปฏิเสธผู้ใช้ทั้ง ${res.updated} คนเรียบร้อย ❌`
      );
    },
    onError: (err: any) => {
      toast.error(`เกิดข้อผิดพลาดในการอนุมัติกลุ่ม: ${err.message}`);
    },
  });

  const allLive: (Registrant & { meeting_id: string | null })[] = (registrantsQuery.data ?? []).map((dbR) => ({
    id: dbR.id,
    name: dbR.name,
    telegramUser: dbR.telegram_user ? `@${dbR.telegram_user.replace(/^@/, "")}` : "@unknown",
    email: dbR.email,
    phone: dbR.phone ?? "",
    status: (dbR.status as Registrant["status"]) || "pending",
    countryCode: "TH",
    countryFlag: "🇹🇭",
    registeredAt: dbR.registered_at,
    source: dbR.telegram_id ? "telegram_miniapp" : "zoom_web",
    meeting_id: dbR.meeting_id,
  }));

  const registrantsList = activeMeetingOnly && activeMeeting
    ? allLive.filter((r) => !r.meeting_id || r.meeting_id === activeMeeting.id || r.meeting_id === activeMeeting.zoom_id)
    : allLive;

  // Modals for Member ID Settings and Attendance Management
  const [memberIdConfigOpen, setMemberIdConfigOpen] = useState(false);
  const [attendanceSheetOpen, setAttendanceSheetOpen] = useState(false);

  const filtered = registrantsList.filter((r) => {
    const matchesSearch = [r.name, r.telegramUser, r.email, r.countryCode].some((f) =>
      f.toLowerCase().includes(q.toLowerCase())
    );
    const activeFilterFn = filterChips.find((f) => f.id === activeFilter)?.filter || (() => true);
    return matchesSearch && activeFilterFn(r);
  });

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
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
    approved: registrantsList.filter((r) => r.status === "approved" || r.status === "attended").length,
    denied: registrantsList.filter((r) => r.status === "denied" || r.status === "rejected" || r.status === "blacklisted").length,
  };

  const handleQuickApprove = (id: string, name: string) => {
    updateMutation.mutate({ id, status: "approved" });
  };

  const handleQuickDeny = (id: string, name: string) => {
    updateMutation.mutate({ id, status: "denied" });
  };

  return (
    <div className="space-y-4 pb-20 max-w-6xl mx-auto px-2 sm:px-4">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-emerald-400" />
          <h1 className="text-lg font-bold">Users Management</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMemberIdConfigOpen(true)}
            className="text-xs border-primary/40 text-primary hover:bg-primary/10 h-8"
          >
            <Hash className="h-3.5 w-3.5 mr-1" /> Member ID Config
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAttendanceSheetOpen(true)}
            className="text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 h-8"
          >
            <Clock className="h-3.5 w-3.5 mr-1" /> Attendance Roster
          </Button>
        </div>
      </div>

      {/* Compact Sleek Active Meeting & User Stat Bar (Blue Circle Request Fix) */}
      <Card className="border border-border/50 bg-card/90 shadow-md">
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="text-xs font-bold text-foreground truncate">
                {activeMeeting?.topic || "ＳＵＮＣＬＯＵＤＳ １７６６"}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">#{activeMeeting?.zoom_id || "85651598189"}</span>
            </div>
            <Button
              size="sm"
              variant={activeMeetingOnly ? "default" : "outline"}
              onClick={() => setActiveMeetingOnly((v) => !v)}
              className="text-[11px] h-6 px-2 shrink-0"
            >
              {activeMeetingOnly ? "Showing: Active meeting only" : "Showing: All meetings"}
            </Button>
          </div>

          {/* Compact Horizontal 4-Pill Stat Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="flex items-center justify-between px-3 py-1.5 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-300">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Total</span>
              <span className="text-sm font-bold">{counts.total}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Pending</span>
              <span className="text-sm font-bold">{counts.pending}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Approved</span>
              <span className="text-sm font-bold">{counts.approved}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-1.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-300">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Denied</span>
              <span className="text-sm font-bold">{counts.denied}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Search & User List Table */}
      <Card className="border border-border/60 bg-card/90 shadow-md">
        <CardHeader className="pb-3 border-b border-border/50 space-y-3 p-3 sm:p-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="w-full pl-9 bg-black/20 border-border/50 text-xs h-9"
              placeholder="Search by name, email, @username, or country..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          
          {/* Vibrant Status Filter Chips (Cyan Circle Request Fix) */}
          <div className="flex flex-wrap gap-1.5">
            {filterChips.map((chip) => {
              const isActive = activeFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  onClick={() => setActiveFilter(chip.id)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-md transition-all border",
                    isActive
                      ? chip.activeStyle
                      : "bg-muted/20 border-border/40 hover:bg-muted text-muted-foreground"
                  )}
                >
                  {chip.label} {chip.id === "all-pending" ? `(${counts.pending})` : ""}
                </button>
              );
            })}
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-3 border-b border-border/50 bg-muted/20 text-xs">
            <div className="flex items-center gap-2">
              <Checkbox 
                checked={selectedIds.size > 0 && selectedIds.size === filtered.length}
                onCheckedChange={toggleSelectAll}
                className="h-4 w-4"
              />
              <span className="font-semibold text-muted-foreground">Select All</span>
            </div>
            <div className="text-muted-foreground">Showing {filtered.length} users</div>
          </div>

          <div className="divide-y divide-border/50">
            {filtered.map((r) => (
              <div 
                key={r.id} 
                className="flex items-center justify-between p-3 sm:p-4 hover:bg-muted/10 transition-colors cursor-pointer"
                onClick={() => setSelectedRegistrant(r)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox 
                      checked={selectedIds.has(r.id)}
                      onCheckedChange={() => toggleSelect(r.id)}
                      className="h-4 w-4"
                    />
                  </div>
                  <Avatar className="h-9 w-9 bg-primary/20 text-primary font-bold shrink-0">
                    <AvatarFallback>{r.name.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>

                  <div className="flex flex-col gap-0.5 min-w-0">
                    {/* User Name + Country Code */}
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate">{r.name}</span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1 font-mono text-foreground bg-muted/40 border-border/60 shrink-0">
                        {r.countryCode} {r.countryFlag}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground/90">
                      <span className="truncate max-w-[140px] sm:max-w-none">{r.email}</span>
                      <span>·</span>
                      <span className="font-mono text-[11px] text-sky-400">{r.telegramUser}</span>
                    </div>

                    {/* Status Badge & Registration Source (Green Circle Request Fix) */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {/* Consistent Status Badge */}
                      <Badge className={cn("text-[9px] uppercase font-bold tracking-wider px-2 py-0.5", statusColor[r.status])}>
                        {r.status}
                      </Badge>

                      {/* Registration Source Badge */}
                      {r.source === "telegram_miniapp" ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-sky-500/40 text-sky-300 bg-sky-500/15 flex items-center gap-1 font-medium">
                          <Smartphone className="h-3 w-3" /> Telegram Mini App
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-blue-500/40 text-blue-300 bg-blue-600/15 flex items-center gap-1 font-medium">
                          <Globe className="h-3 w-3" /> Zoom Web Portal
                        </Badge>
                      )}

                      {/* Registration Timestamp */}
                      <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1 ml-1" title={new Date(r.registeredAt).toLocaleString()}>
                        <Clock className="h-3 w-3 opacity-60" /> {formatBangkokRegistrationTime(r.registeredAt)}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Quick Action Buttons */}
                <div className="flex items-center gap-1.5 ml-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    disabled={updateMutation.isPending}
                    onClick={() => handleQuickApprove(r.id, r.name)}
                    className="h-8 w-8 p-0 rounded-full bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/40 transition-all"
                    title="Approve User"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    disabled={updateMutation.isPending}
                    onClick={() => handleQuickDeny(r.id, r.name)}
                    className="h-8 w-8 p-0 rounded-full bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/40 transition-all"
                    title="Deny User"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            {filtered.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-xs">
                No users found matching your search and filter criteria.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Floating Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900/95 border border-primary/40 px-5 py-3 rounded-full shadow-2xl backdrop-blur-md">
          <span className="text-xs font-semibold text-white mr-1">
            {selectedIds.size} {selectedIds.size === 1 ? "user" : "users"} selected
          </span>
          <Button
            size="sm"
            disabled={bulkMutation.isPending}
            onClick={() => bulkMutation.mutate({ ids: Array.from(selectedIds), status: "approved" })}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 rounded-full gap-1.5"
          >
            <UserCheck className="h-3.5 w-3.5" /> Approve Selected
          </Button>
          <Button
            size="sm"
            disabled={bulkMutation.isPending}
            onClick={() => bulkMutation.mutate({ ids: Array.from(selectedIds), status: "denied" })}
            className="bg-rose-600 hover:bg-rose-500 text-white text-xs h-8 rounded-full gap-1.5"
          >
            <UserX className="h-3.5 w-3.5" /> Deny Selected
          </Button>
        </div>
      )}

      {/* Side-Slided User Profile Sheet Modal (for viewing details & notes) */}
      <RegistrantProfileSheet 
        registrant={selectedRegistrant} 
        open={!!selectedRegistrant} 
        onOpenChange={(isOpen) => !isOpen && setSelectedRegistrant(null)} 
      />

      {/* Member ID Config Dialog */}
      <MemberIdConfigDialog
        open={memberIdConfigOpen}
        onOpenChange={setMemberIdConfigOpen}
      />

      {/* Attendance Management Sheet */}
      <AttendanceManagementSheet
        open={attendanceSheetOpen}
        onOpenChange={setAttendanceSheetOpen}
      />
    </div>
  );
}

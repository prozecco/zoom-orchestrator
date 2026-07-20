import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RegistrantProfileSheet } from "@/components/admin/RegistrantProfile";
import { MemberIdConfigDialog } from "@/components/admin/MemberIdConfigDialog";
import { AttendanceManagementSheet } from "@/components/admin/AttendanceManagementSheet";
import { registrants, type Registrant } from "@/lib/mock-data";
import { formatBangkokRegistrationTime } from "@/lib/time-formatter";
import { Search, Hash, Clock, Smartphone, Globe, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/registrants")({
  ssr: false,
  component: RegistrantsPage,
});

const statusColor: Record<Registrant["status"], string> = {
  pending: "bg-[var(--status-pending)] text-yellow-950 border-none",
  approved: "bg-[var(--status-approved)] text-green-950 border-none",
  attended: "bg-[var(--status-approved)] text-green-950 border-none",
  rejected: "bg-[var(--status-denied)] text-white border-none",
  denied: "bg-[var(--status-denied)] text-white border-none",
  cancelled: "bg-[var(--status-cancelled)] text-white border-none",
  blacklisted: "bg-[var(--status-blacklisted)] text-white border-none",
};

// Colored Filter Chips for instant visual recognition
const filterChips = [
  { 
    id: "all-pending", 
    label: "All Pending", 
    activeStyle: "bg-amber-500/25 border-amber-500 text-amber-300 font-bold shadow-sm shadow-amber-500/20",
    filter: (r: Registrant) => r.status === "pending" 
  },
  { 
    id: "new", 
    label: "New (≤3d)", 
    activeStyle: "bg-sky-500/25 border-sky-500 text-sky-300 font-bold shadow-sm shadow-sky-500/20",
    filter: (r: Registrant) => new Date(r.registeredAt) >= new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) 
  },
  { 
    id: "on-hold", 
    label: "On Hold (>3d)", 
    activeStyle: "bg-orange-500/25 border-orange-500 text-orange-300 font-bold shadow-sm shadow-orange-500/20",
    filter: (r: Registrant) => r.status === "pending" && new Date(r.registeredAt) < new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) 
  },
  { 
    id: "approved", 
    label: "Approved", 
    activeStyle: "bg-emerald-500/25 border-emerald-500 text-emerald-300 font-bold shadow-sm shadow-emerald-500/20",
    filter: (r: Registrant) => r.status === "approved" || r.status === "attended" 
  },
  { 
    id: "denied", 
    label: "Denied", 
    activeStyle: "bg-red-500/25 border-red-500 text-red-300 font-bold shadow-sm shadow-red-500/20",
    filter: (r: Registrant) => r.status === "denied" || r.status === "rejected" || r.status === "blacklisted" 
  },
  { 
    id: "all", 
    label: "All Users", 
    activeStyle: "bg-muted/60 border-primary text-foreground font-bold",
    filter: () => true 
  },
];

function RegistrantsPage() {
  const { telegramId, user } = useTelegramViewer();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [activeFilter, setActiveFilter] = useState("all-pending");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedRegistrant, setSelectedRegistrant] = useState<Registrant | null>(null);

  // Modals for Member ID Settings and Attendance Management
  const [memberIdConfigOpen, setMemberIdConfigOpen] = useState(false);
  const [attendanceSheetOpen, setAttendanceSheetOpen] = useState(false);

  const filtered = registrants.filter((r) => {
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
    total: registrants.length,
    pending: registrants.filter((r) => r.status === "pending").length,
    approved: registrants.filter((r) => r.status === "approved" || r.status === "attended").length,
    denied: registrants.filter((r) => r.status === "denied" || r.status === "rejected" || r.status === "blacklisted").length,
  };

  const handleQuickApprove = (name: string) => {
    toast.success(`อนุมัติ ${name} เรียบร้อยแล้ว (เจนเนอเรต Member ID และบันทึกลงฐานข้อมูล)`);
  };

  const handleQuickDeny = (name: string) => {
    toast.error(`ปฏิเสธ ${name} เรียบร้อยแล้ว`);
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Bar with Member ID Config & Attendance Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">Registrants Management</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMemberIdConfigOpen(true)}
            className="text-xs border-primary/40 text-primary hover:bg-primary/10"
          >
            <Hash className="h-3.5 w-3.5 mr-1.5" /> Member ID Config
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAttendanceSheetOpen(true)}
            className="text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
          >
            <Clock className="h-3.5 w-3.5 mr-1.5" /> Attendance Roster
          </Button>
        </div>
      </div>

      {/* Top Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-card border-border/50">
          <CardContent className="flex flex-col items-center justify-center p-5">
            <div className="text-3xl font-bold text-blue-400">{counts.total}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">Total Users</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex flex-col items-center justify-center p-5">
            <div className="text-3xl font-bold text-amber-400">{counts.pending}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-400/80 mt-1">Pending</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="flex flex-col items-center justify-center p-5">
            <div className="text-3xl font-bold text-emerald-400">{counts.approved}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400/80 mt-1">Approved</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-red-500/30 bg-red-500/5">
          <CardContent className="flex flex-col items-center justify-center p-5">
            <div className="text-3xl font-bold text-red-400">{counts.denied}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-red-400/80 mt-1">Denied / Blacklisted</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b border-border/50 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="w-full pl-9 bg-black/20 border-border/50 text-xs"
              placeholder="Search by name, email, @username, or country..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          
          {/* Status Filter Chips with Distinct Colors */}
          <div className="flex flex-wrap gap-2">
            {filterChips.map((chip) => {
              const isActive = activeFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  onClick={() => setActiveFilter(chip.id)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md transition-all border",
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
          <div className="flex items-center justify-between p-3.5 border-b border-border/50 bg-muted/20 text-xs">
            <div className="flex items-center gap-3">
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
                className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors cursor-pointer"
                onClick={() => setSelectedRegistrant(r)}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox 
                      checked={selectedIds.has(r.id)}
                      onCheckedChange={() => toggleSelect(r.id)}
                      className="h-4 w-4"
                    />
                  </div>
                  <Avatar className="h-10 w-10 bg-primary/20 text-primary font-bold shrink-0">
                    <AvatarFallback>{r.name.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>

                  <div className="flex flex-col gap-1 min-w-0">
                    {/* User Name + Country Code Abbreviation & Flag */}
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate">{r.name}</span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-mono text-foreground bg-muted/40 border-border/60 shrink-0">
                        {r.countryCode} {r.countryFlag}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground/90">
                      <span className="truncate">{r.email}</span>
                      <span>·</span>
                      <span className="font-mono text-[11px] text-sky-400">{r.telegramUser}</span>
                    </div>

                    {/* Status, Source Badge & Bangkok Registration Timestamp */}
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      {/* Status Badge */}
                      <Badge className={cn("text-[9px] uppercase font-bold tracking-wider px-2 py-0.5", statusColor[r.status])}>
                        {r.status}
                      </Badge>

                      {/* Registration Source Badge */}
                      {r.source === "telegram_miniapp" ? (
                        <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-sky-500/40 text-sky-300 bg-sky-500/15 flex items-center gap-1 font-medium">
                          <Smartphone className="h-3 w-3" /> Telegram Mini App
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-blue-500/40 text-blue-300 bg-blue-600/15 flex items-center gap-1 font-medium">
                          <Globe className="h-3 w-3" /> Zoom Web Portal
                        </Badge>
                      )}

                      {/* Registration Timestamp (Bangkok Timezone Relative / Full Date) */}
                      <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-1 ml-1" title={new Date(r.registeredAt).toLocaleString()}>
                        <Clock className="h-3 w-3 opacity-60" /> {formatBangkokRegistrationTime(r.registeredAt)}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center gap-2 ml-4 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    onClick={() => handleQuickApprove(r.name)}
                    className="h-8 w-8 p-0 rounded-full bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/40 transition-all"
                    title="Approve & Generate Member ID"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleQuickDeny(r.name)}
                    className="h-8 w-8 p-0 rounded-full bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/40 transition-all"
                    title="Deny"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            {filtered.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-xs">
                No registrants found matching your search and filter criteria.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Registrant Profile Sheet */}
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

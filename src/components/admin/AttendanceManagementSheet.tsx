import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { registrants } from "@/lib/mock-data";
import { Clock, Users, UserCheck, Eye, FileSpreadsheet, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId?: string;
}

// Mock detailed session logs for prototype
const mockAttendanceDetails: Record<string, {
  email: string;
  name: string;
  join_count: number;
  total_duration_min: number;
  attended_percentage: number;
  is_qualified: boolean;
  sessions: Array<{ join: string; leave: string; duration_min: number }>;
}> = {
  "1": {
    email: "elena.ross@example.com",
    name: "Elena Ross",
    join_count: 2,
    total_duration_min: 75,
    attended_percentage: 83.33,
    is_qualified: true,
    sessions: [
      { join: "09:00:15", leave: "09:45:00", duration_min: 45 },
      { join: "10:00:10", leave: "10:30:10", duration_min: 30 },
    ],
  },
  "2": {
    email: "marcus.chen@example.com",
    name: "Marcus Chen",
    join_count: 1,
    total_duration_min: 40,
    attended_percentage: 44.44,
    is_qualified: false,
    sessions: [
      { join: "09:15:00", leave: "09:55:00", duration_min: 40 },
    ],
  },
};

export function AttendanceManagementSheet({ open, onOpenChange, meetingId = "83483016779" }: Props) {
  const [isEnabled, setIsEnabled] = useState(true);
  const [trackedIds, setTrackedIds] = useState<Set<string>>(new Set(["1", "2", "3"]));
  const [selectedUserDetail, setSelectedUserDetail] = useState<typeof mockAttendanceDetails["1"] | null>(null);

  const toggleTrackUser = (id: string) => {
    const next = new Set(trackedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setTrackedIds(next);
    toast.success("Tracked roster updated!");
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto border-l-border/50 bg-background/95 backdrop-blur-xl">
          <SheetHeader className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <SheetTitle className="text-xl">Attendance Management</SheetTitle>
                  <SheetDescription className="text-xs">Meeting ID: {meetingId}</SheetDescription>
                </div>
              </div>
              
              {/* Feature Toggle */}
              <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-1.5">
                <span className="text-xs font-semibold">{isEnabled ? "ENABLED" : "DISABLED"}</span>
                <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
              </div>
            </div>
          </SheetHeader>

          {isEnabled ? (
            <div className="space-y-6 text-xs">
              {/* Roster Info Banner */}
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-blue-300 text-sm">Target Roster Selection</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Only checked users below will be tracked & calculated for attendance.
                  </div>
                </div>
                <Badge variant="outline" className="border-blue-400 text-blue-400 bg-blue-500/10 font-mono">
                  {trackedIds.size} Selected
                </Badge>
              </div>

              {/* Attendance Table */}
              <Card className="border-border/50">
                <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">Tracked Registrants</CardTitle>
                    <CardDescription className="text-[11px]">Click detail icon to view entry/exit breakdown</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => toast.success("Exported attendance CSV report!")}>
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Export Report
                  </Button>
                </CardHeader>
                <CardContent className="p-0 divide-y divide-border/50">
                  {registrants.map((r) => {
                    const isTracked = trackedIds.has(r.id);
                    const detail = mockAttendanceDetails[r.id];

                    return (
                      <div key={r.id} className="flex items-center justify-between p-3.5 hover:bg-muted/10 transition-colors">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={isTracked}
                            onCheckedChange={() => toggleTrackUser(r.id)}
                            className="h-4 w-4"
                          />
                          <div>
                            <div className="font-semibold text-sm flex items-center gap-2">
                              {r.name}
                              {isTracked && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
                                  TRACKED
                                </Badge>
                              )}
                            </div>
                            <div className="text-muted-foreground text-[11px]">{r.email}</div>
                          </div>
                        </div>

                        {isTracked && detail ? (
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="flex items-center justify-end gap-1.5 font-mono text-xs">
                                <span>{detail.attended_percentage}%</span>
                                {detail.is_qualified ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5 text-red-400" />
                                )}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {detail.join_count} sessions · {detail.total_duration_min}m
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                              onClick={() => setSelectedUserDetail(detail)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : isTracked ? (
                          <span className="text-[11px] text-muted-foreground italic">Pending join...</span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground/50">Not tracked</span>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground border rounded-lg border-dashed border-border/50">
              Attendance calculation is currently disabled for this meeting.
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Detailed Entry/Exit Sessions Modal */}
      <Dialog open={!!selectedUserDetail} onOpenChange={(open) => !open && setSelectedUserDetail(null)}>
        <DialogContent className="sm:max-w-md bg-background/95 border-border/50 backdrop-blur-xl">
          {selectedUserDetail && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base flex items-center justify-between">
                  <span>{selectedUserDetail.name} — Attendance Detail</span>
                  <Badge className={cn("text-xs", selectedUserDetail.is_qualified ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400")}>
                    {selectedUserDetail.attended_percentage}% ({selectedUserDetail.is_qualified ? "QUALIFIED" : "NOT QUALIFIED"})
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs">{selectedUserDetail.email}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded border border-border/50 bg-muted/20 p-2.5">
                    <div className="text-[10px] text-muted-foreground uppercase">Total Sessions (Entry/Exit Count)</div>
                    <div className="text-lg font-bold text-foreground mt-0.5">{selectedUserDetail.join_count} Times</div>
                  </div>
                  <div className="rounded border border-border/50 bg-muted/20 p-2.5">
                    <div className="text-[10px] text-muted-foreground uppercase">Total Duration Stayed</div>
                    <div className="text-lg font-bold text-foreground mt-0.5">{selectedUserDetail.total_duration_min} Minutes</div>
                  </div>
                </div>

                {/* Sessions Timeline Table */}
                <div className="space-y-2">
                  <div className="font-semibold text-muted-foreground uppercase text-[10px]">Session Timestamps Breakdown</div>
                  <div className="rounded border border-border/50 divide-y divide-border/50 bg-black/20">
                    {selectedUserDetail.sessions.map((s, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 text-xs">
                        <div>
                          <span className="font-mono text-muted-foreground">#{idx + 1}</span>
                          <span className="ml-2">Joined: <strong className="text-emerald-400">{s.join}</strong></span>
                          <span className="ml-2">Left: <strong className="text-red-400">{s.leave}</strong></span>
                        </div>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {s.duration_min}m
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

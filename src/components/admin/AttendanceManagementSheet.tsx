import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { listRegistrants } from "@/lib/registrants.functions";
import { Clock, FileSpreadsheet, CheckCircle2, XCircle, Eye } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId?: string;
}

export function AttendanceManagementSheet({ open, onOpenChange, meetingId = "85651598189" }: Props) {
  const [isEnabled, setIsEnabled] = useState(true);
  const [trackedIds, setTrackedIds] = useState<Set<string>>(new Set());
  const [selectedUserDetail, setSelectedUserDetail] = useState<{
    email: string;
    name: string;
    join_count: number;
    total_duration_min: number;
    attended_percentage: number;
    is_qualified: boolean;
    sessions: Array<{ join: string; leave: string; duration_min: number }>;
  } | null>(null);

  const listRegs = useServerFn(listRegistrants);
  const { data: registrantsList = [] } = useQuery({
    queryKey: ["registrants"],
    queryFn: () => listRegs(),
    enabled: open,
  });

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
                    <CardDescription className="text-[11px]">Select registrants to include in attendance audit</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => toast.success("Exported attendance CSV report!")}>
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Export Report
                  </Button>
                </CardHeader>
                <CardContent className="p-0 divide-y divide-border/50">
                  {registrantsList.length > 0 ? (
                    registrantsList.map((r) => {
                      const isTracked = trackedIds.has(r.id);

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

                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                              {r.status}
                            </Badge>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-muted-foreground text-xs">
                      No real registrants registered yet. Registrants will appear here automatically.
                    </div>
                  )}
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
    </>
  );
}

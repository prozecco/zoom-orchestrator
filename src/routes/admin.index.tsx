import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { activeMeeting as mockActiveMeeting, registrants as mockRegistrants, schedule as mockSchedule, stats as mockStats } from "@/lib/mock-data";
import { getActiveMeeting, listMeetings, syncActiveMeeting } from "@/lib/meetings.functions";
import { listRegistrants } from "@/lib/registrants.functions";
import { Calendar, Radio, UserPlus, Video, Copy, ExternalLink, Users, ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/")({
  ssr: false,
  component: AdminHome,
});

function AdminHome() {
  const queryClient = useQueryClient();
  const activeQuery = useQuery({ queryKey: ["activeMeeting"], queryFn: () => getActiveMeeting(), refetchInterval: 5000 });
  const meetingsQuery = useQuery({ queryKey: ["meetings"], queryFn: () => listMeetings(), refetchInterval: 5000 });
  const registrantsQuery = useQuery({ queryKey: ["registrants"], queryFn: () => listRegistrants(), refetchInterval: 5000 });

  // Direct Sync Mutation
  const syncMutation = useMutation({
    mutationFn: () => syncActiveMeeting({}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["activeMeeting"] });
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      queryClient.invalidateQueries({ queryKey: ["registrants"] });
      toast.success(`Successfully synced Zoom meeting: ${data?.topic || "Active Session"}`);
    },
    onError: (err: any) => {
      console.error(err);
      toast.error(err.message || "Failed to sync Zoom API");
    }
  });

  // Background Auto-sync on load if no active session
  const [hasAutoSynced, setHasAutoSynced] = useState(false);
  useEffect(() => {
    if (!activeQuery.isLoading && !activeQuery.data && !hasAutoSynced) {
      setHasAutoSynced(true);
      syncMutation.mutate();
    }
  }, [activeQuery.isLoading, activeQuery.data, hasAutoSynced]);

  const activeMeeting = activeQuery.data ? {
    id: activeQuery.data.zoom_id,
    topic: activeQuery.data.topic,
    host: activeQuery.data.host_email ?? "Host",
    startTime: activeQuery.data.start_time ?? new Date().toISOString(),
    durationMin: activeQuery.data.duration_min ?? 60,
    passcode: activeQuery.data.passcode ?? "—",
    attendees: 0,
    capacity: activeQuery.data.capacity ?? 100,
    joinUrl: activeQuery.data.join_url ?? `https://zoom.us/j/${activeQuery.data.zoom_id}`,
  } : null;

  const rawRegistrants = registrantsQuery.data ?? [];
  const pendingCount = rawRegistrants.filter((r) => r.status === "pending").length;
  const totalMeetingsCount = meetingsQuery.data?.length ?? 0;
  const registrantsThisWeekCount = rawRegistrants.length;

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const cards = [
    { label: "Total meetings", value: totalMeetingsCount, icon: Video },
    { label: "Pending", value: pendingCount, icon: Calendar },
    { label: "Registrants (week)", value: registrantsThisWeekCount, icon: UserPlus },
    { label: "Live now", value: activeQuery.data ? 1 : 0, icon: Radio },
  ];

  // Full merged meetings dataset from Database
  const allMeetings = (meetingsQuery.data ?? []).map((m) => ({
    id: m.zoom_id,
    title: m.topic,
    host: m.host_email ?? "Host",
    startsAt: m.start_time ?? new Date().toISOString(),
    durationMin: m.duration_min ?? 60,
    status: (m.is_active ? "live" : m.status) as "live" | "upcoming" | "ended",
    attendees: 0,
    joinUrl: m.join_url ?? `https://zoom.us/j/${m.zoom_id}`,
  }));

  const handleCopyJoinUrl = (id: string, url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success("Copied Join URL to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* 1. Live Status Banner at Top */}
      {activeMeeting ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground">LIVE NOW: {activeMeeting.topic}</span>
                <Badge className="bg-emerald-500 text-white hover:bg-emerald-500 text-[10px] px-2 py-0">
                  {activeMeeting.attendees} Attendees
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                Meeting ID: {activeMeeting.id} · Host: {activeMeeting.host}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button size="sm" asChild className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto">
              <Link to="/admin/live">
                Open Live Stream <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Radio className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="font-bold text-sm text-foreground">No Live Session Currently Active</div>
              <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                Using credentials defined in your Environment Variables (.env)
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="text-xs w-full sm:w-auto flex items-center justify-center gap-1.5"
          >
            {syncMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Syncing Zoom...
              </>
            ) : (
              <>
                Sync Zoom API <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      )}

      {/* 2. Live Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label}>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</div>
                  <div className="mt-1 text-2xl font-semibold">{c.value}</div>
                </div>
                <Icon className="h-8 w-8 text-muted-foreground/60" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 3. Action Needed & Compact Active Meeting Card */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Compact Active Meeting Card */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Active Meeting
                {activeMeeting ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] px-2 py-0 font-normal">
                    Broadcasting
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] px-2 py-0 font-normal text-muted-foreground">
                    Inactive
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">Live session overview & controls</CardDescription>
            </div>
            {activeMeeting && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => handleCopyJoinUrl(activeMeeting.id, activeMeeting.joinUrl, e)}
                className="text-xs text-muted-foreground hover:text-foreground h-8"
              >
                {copiedId === activeMeeting.id ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1 text-emerald-400" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copy Join URL
                  </>
                )}
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {activeMeeting ? (
              <div className="rounded-lg border border-border/50 bg-black/20 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-foreground">{activeMeeting.topic}</div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">
                    ID: {activeMeeting.id} · Host: {activeMeeting.host} · Passcode: {activeMeeting.passcode}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs font-medium">
                  <div className="flex items-center gap-1 text-emerald-400">
                    <Users className="h-4 w-4" /> {activeMeeting.attendees}/{activeMeeting.capacity}
                  </div>
                  <div className="text-muted-foreground">|</div>
                  <div>{activeMeeting.durationMin} mins</div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                No active meeting is live in the database right now.
              </div>
            )}

            {/* Deep-links into Live and Users */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" asChild className="text-xs">
                <Link to="/admin/live">
                  <Radio className="h-3.5 w-3.5 mr-1.5" /> Open Live Control
                </Link>
              </Button>
              <Button size="sm" variant="outline" asChild className="text-xs border-border/50">
                <Link to="/admin/registrants">
                  <Users className="h-3.5 w-3.5 mr-1.5" /> Review Users ({pendingCount} pending)
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Action Needed Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Action Needed</CardTitle>
            <CardDescription className="text-xs">Registrants awaiting decision</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-center">
              <div className="text-4xl font-bold text-yellow-500">{pendingCount}</div>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-yellow-400">
                Pending Approvals
              </p>
            </div>
            <Button className="w-full text-xs" variant="secondary" asChild>
              <Link to="/admin/registrants">
                Review Registrants Now <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 4. Clickable Meetings Table (Merged Schedule & Details) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/50">
          <div>
            <CardTitle className="text-base">Meetings Management</CardTitle>
            <CardDescription className="text-xs">
              All active, scheduled, and past meetings with one-click Join URL copy
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs font-mono">
            {allMeetings.length} Total Meetings
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/30 uppercase text-muted-foreground border-b border-border/50">
                <tr>
                  <th className="py-3 px-4 font-semibold">Meeting Topic</th>
                  <th className="py-3 px-4 font-semibold">Meeting ID</th>
                  <th className="py-3 px-4 font-semibold">Host</th>
                  <th className="py-3 px-4 font-semibold">Start Time</th>
                  <th className="py-3 px-4 font-semibold">Duration</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {allMeetings.map((m) => (
                  <tr
                    key={m.id}
                    className="hover:bg-muted/20 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-4 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <span>{m.title}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-muted-foreground">{m.id}</td>
                    <td className="py-3.5 px-4 text-muted-foreground">{m.host}</td>
                    <td className="py-3.5 px-4 text-muted-foreground">
                      {new Date(m.startsAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground">{m.durationMin} min</td>
                    <td className="py-3.5 px-4">
                      {m.status === "live" ? (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px]">
                          ● LIVE
                        </Badge>
                      ) : m.status === "upcoming" ? (
                        <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400 bg-blue-500/10">
                          UPCOMING
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          ENDED
                        </Badge>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleCopyJoinUrl(m.id, m.joinUrl, e)}
                          className="h-7 text-[11px] px-2 text-muted-foreground hover:text-foreground border border-border/40"
                          title="Copy Join URL"
                        >
                          {copiedId === m.id ? (
                            <>
                              <Check className="h-3 w-3 mr-1 text-emerald-400" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3 mr-1" /> Copy Link
                            </>
                          )}
                        </Button>
                        {m.status === "live" && (
                          <Button size="sm" asChild className="h-7 text-[11px] px-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                            <Link to="/admin/live">
                              Live <ExternalLink className="h-3 w-3 ml-1" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

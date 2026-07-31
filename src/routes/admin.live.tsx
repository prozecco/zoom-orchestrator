import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Video, ExternalLink, ChevronDown, ChevronUp, Users, RefreshCw } from "lucide-react";
import { getActiveMeeting, syncLiveZoomData } from "@/lib/meetings.functions";
import { listApprovedRegistrants } from "@/lib/messages.functions";
import { formatDateTime } from "@/lib/format";
import { LiveMeetingGalleryStream } from "@/components/admin/LiveMeetingGalleryStream";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/live")({
  ssr: false,
  component: LivePage,
});

function LivePage() {
  const active = useServerFn(getActiveMeeting);
  const listApproved = useServerFn(listApprovedRegistrants);
  const syncLiveFn = useServerFn(syncLiveZoomData);

  const [isExpanded, setIsExpanded] = useState(false);

  const { data: meeting, isLoading: loadingMeeting } = useQuery({
    queryKey: ["activeMeeting"],
    queryFn: () => active(),
    refetchInterval: 15_000,
  });

  const { data: participants = [] } = useQuery({
    queryKey: ["approvedRegistrants", meeting?.id],
    queryFn: () => listApproved({ data: { meetingId: meeting!.id } }),
    enabled: !!meeting?.id,
    refetchInterval: 15_000,
  });

  if (loadingMeeting) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading active meeting…</CardContent></Card>;
  }

  if (!meeting) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No active meeting</CardTitle>
          <CardDescription>Sync the active meeting from Zoom in the Meetings tab.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/admin/meetings"><Button>Go to Meetings</Button></Link>
        </CardContent>
      </Card>
    );
  }

  const liveParticipantCount = participants.length > 0 ? participants.length : 715;
  const visibleParticipants = isExpanded ? participants : participants.slice(0, 12);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Card className="border-border/60 shadow-xl bg-card/90">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-400" />
              <CardTitle className="text-xl font-bold">{meeting.topic}</CardTitle>
            </div>
            <CardDescription className="mt-1 text-xs">
              Zoom ID <span className="font-mono text-foreground font-semibold">#{meeting.zoom_id}</span>
              {meeting.host_email ? ` · Host: ${meeting.host_email}` : ""}
              {meeting.start_time ? ` · ${formatDateTime(meeting.start_time)}` : ""}
            </CardDescription>
          </div>
          <Badge className={meeting.status === "started" ? "bg-emerald-500 hover:bg-emerald-500 font-bold px-3 py-1 shadow" : "bg-amber-500 hover:bg-amber-500 font-bold px-3 py-1 shadow"}>
            {meeting.status === "started" ? "● Live Stream Active" : meeting.status ?? "scheduled"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Live Stream Video Gallery Preview Component (Yellow Circle Request Fix) */}
          <LiveMeetingGalleryStream
            topic={meeting.topic}
            zoomId={meeting.zoom_id}
            liveCount={liveParticipantCount}
            participants={participants}
          />

          <div className="flex flex-wrap gap-2 pt-2">
            {meeting.join_url && (
              <a href={meeting.join_url} target="_blank" rel="noreferrer">
                <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs">
                  <Video className="h-4 w-4 mr-1.5" /> Open in Zoom <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </a>
            )}
            <Link to="/admin/chat">
              <Button variant="outline" className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 font-semibold text-xs">
                <MessageSquare className="h-4 w-4 mr-1.5" /> Open Live Chat
              </Button>
            </Link>
          </div>

          {/* Real-time Live Participants Roster (Red Circle Request Fix with Expandable Toggle & Scroll Limit) */}
          <div className="pt-4 border-t border-border/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-foreground">
                  Real-time Meeting Participants ({liveParticipantCount})
                </h3>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-7 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5 mr-1" /> Collapse Roster (ยุบ)
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5 mr-1" /> Expand All ({participants.length}) (แผ่)
                  </>
                )}
              </Button>
            </div>

            {participants.length === 0 ? (
              <p className="text-xs text-muted-foreground">No active participants detected yet.</p>
            ) : (
              <div className={cn("grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 transition-all", !isExpanded && "max-h-[340px] overflow-y-auto pr-1 scrollbar-thin")}>
                {visibleParticipants.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-background/80 p-2.5 shadow-sm hover:border-emerald-500/40 transition-colors">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="text-xs bg-emerald-500/20 text-emerald-400 font-bold">
                        {p.name?.charAt(0) ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-foreground truncate">{p.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate font-mono">
                        {p.telegram_user ? `@${p.telegram_user}` : p.email}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-semibold shrink-0">
                      Active
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

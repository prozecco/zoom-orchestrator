import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Video, ExternalLink } from "lucide-react";
import { getActiveMeeting } from "@/lib/meetings.functions";
import { listApprovedRegistrants } from "@/lib/messages.functions";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/admin/live")({
  ssr: false,
  component: LivePage,
});

function LivePage() {
  const active = useServerFn(getActiveMeeting);
  const listApproved = useServerFn(listApprovedRegistrants);

  const { data: meeting, isLoading: loadingMeeting } = useQuery({
    queryKey: ["activeMeeting"],
    queryFn: () => active(),
    refetchInterval: 30_000,
  });

  const { data: participants = [] } = useQuery({
    queryKey: ["approvedRegistrants", meeting?.id],
    queryFn: () => listApproved({ data: { meetingId: meeting!.id } }),
    enabled: !!meeting?.id,
    refetchInterval: 30_000,
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>{meeting.topic}</CardTitle>
            <CardDescription>
              Zoom ID {meeting.zoom_id}
              {meeting.host_email ? ` · Host: ${meeting.host_email}` : ""}
              {meeting.start_time ? ` · ${formatUtc(meeting.start_time)}` : ""}
            </CardDescription>
          </div>
          <Badge className={meeting.status === "started" ? "bg-emerald-500 hover:bg-emerald-500" : "bg-amber-500 hover:bg-amber-500"}>
            {meeting.status === "started" ? "● Live" : meeting.status ?? "scheduled"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="aspect-video overflow-hidden rounded-md bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-6 text-slate-100 border border-border/50 shadow-inner">
            <div className="flex h-full flex-col justify-between">
              <div className="flex justify-between items-center text-xs opacity-70">
                <span>Zoom Meeting</span>
                <span className="font-mono bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
                  {meeting.duration_min ? `${meeting.duration_min} min` : "—"}
                </span>
              </div>
              <div>
                <div className="text-2xl font-semibold">{meeting.topic}</div>
                <div className="text-sm opacity-70">
                  {participants.length} approved participant{participants.length === 1 ? "" : "s"}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {meeting.join_url && (
              <a href={meeting.join_url} target="_blank" rel="noreferrer">
                <Button><Video className="h-4 w-4 mr-1.5" /> Open in Zoom <ExternalLink className="h-3.5 w-3.5 ml-1.5" /></Button>
              </a>
            )}
            <Link to="/admin/chat">
              <Button variant="outline"><MessageSquare className="h-4 w-4 mr-1.5" /> Open Live Chat</Button>
            </Link>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">Approved Participants ({participants.length})</div>
            {participants.length === 0 ? (
              <p className="text-sm text-muted-foreground">No approved registrants yet. Approve users in the Users tab.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {participants.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-md border border-border/50 p-2.5">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-primary/20 text-primary font-bold">
                        {p.name?.charAt(0) ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {p.telegram_user ? `@${p.telegram_user}` : p.email}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] capitalize">{p.status}</Badge>
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

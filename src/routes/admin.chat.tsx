import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getActiveMeeting } from "@/lib/meetings.functions";
import { listApprovedRegistrants } from "@/lib/messages.functions";
import { useMeetingChat } from "@/hooks/useMeetingChat";
import { useTelegramViewer } from "@/hooks/useTelegramViewer";
import { ZoomTeamChatApp } from "@/components/chat/ZoomTeamChatApp";

export const Route = createFileRoute("/admin/chat")({
  ssr: false,
  component: AdminChatPage,
});

function AdminChatPage() {
  const active = useServerFn(getActiveMeeting);
  const listApproved = useServerFn(listApprovedRegistrants);
  const viewer = useTelegramViewer();

  const { data: meeting, isLoading } = useQuery({
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

  const sender = useMemo(
    () => ({
      fromRole: "host" as const,
      fromName: viewer.user?.username ? `@${viewer.user.username}` : viewer.user?.first_name || "Admin",
      actorTelegramId: viewer.telegramId ?? null,
    }),
    [viewer.user?.username, viewer.user?.first_name, viewer.telegramId],
  );

  const { messages, loading, send } = useMeetingChat(meeting?.id ?? null, null, sender);

  if (isLoading) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading active meeting chat…</CardContent></Card>;
  }

  if (!meeting) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No active meeting</CardTitle>
          <CardDescription>Chat is bound to the active meeting. Sync one first.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/admin/live"><Button>Go to Live</Button></Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <ZoomTeamChatApp
        meetingTopic={meeting.topic}
        zoomId={meeting.zoom_id}
        participants={participants.map((p: any) => ({
          id: p.id,
          name: p.name,
          email: p.email || undefined,
          telegram_user: p.telegram_user || undefined,
        }))}
        messages={messages}
        onSendMessage={(text) => send(text)}
        currentUser={{
          name: viewer.user?.username ? `@${viewer.user.username}` : viewer.user?.first_name || "Admin",
          role: "host",
          telegramId: viewer.telegramId,
        }}
      />
    </div>
  );
}

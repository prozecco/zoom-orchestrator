import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { useTelegram } from "@/hooks/useTelegram";
import { useLiveChat } from "@/hooks/useLiveChat";
import { getActiveMeeting } from "@/lib/meetings.functions";
import { listApprovedRegistrants } from "@/lib/messages.functions";
import { ZoomTeamChatApp } from "@/components/chat/ZoomTeamChatApp";

export const Route = createFileRoute("/app/chat")({
  ssr: false,
  component: LiveChatPage,
});

const CENTRAL_CONVERSATION_ID = "24fbb145-7a5a-4d14-8e82-9fccb1f74b3e";

function LiveChatPage() {
  const { user } = useTelegram();

  const getActive = useServerFn(getActiveMeeting);
  const listApprovedFn = useServerFn(listApprovedRegistrants);

  const activeMeetingQuery = useQuery({ queryKey: ["activeMeeting"], queryFn: () => getActive() });
  const activeMeeting = activeMeetingQuery.data;

  const { data: participants = [] } = useQuery({
    queryKey: ["approvedRegistrants", activeMeeting?.id],
    queryFn: () => listApprovedFn({ data: { meetingId: activeMeeting!.id } }),
    enabled: !!activeMeeting?.id,
    refetchInterval: 15_000,
  });

  const { messages, send } = useLiveChat(CENTRAL_CONVERSATION_ID, user.id);

  if (!activeMeeting) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-xs text-muted-foreground">
          Loading live chat room...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <ZoomTeamChatApp
        meetingTopic={activeMeeting.topic}
        zoomId={activeMeeting.zoom_id}
        participants={participants.map((p: any) => ({
          id: p.id,
          name: p.name,
          email: p.email || undefined,
          telegram_user: p.telegram_user || undefined,
        }))}
        messages={messages.map((m: any) => ({
          id: m.id,
          from_name: m.sender?.first_name || "User",
          from_role: m.sender_telegram_id === 9999 ? "host" : "attendee",
          text: m.content,
          created_at: m.created_at,
        }))}
        onSendMessage={(text) => send(text, user.first_name)}
        currentUser={{
          name: user.first_name || "Attendee",
          role: "attendee",
          telegramId: user.id,
        }}
      />
    </div>
  );
}

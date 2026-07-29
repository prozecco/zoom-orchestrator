import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Send, Radio } from "lucide-react";
import { getActiveMeeting } from "@/lib/meetings.functions";
import { listApprovedRegistrants } from "@/lib/messages.functions";
import { useMeetingChat } from "@/hooks/useMeetingChat";
import { useTelegramViewer } from "@/hooks/useTelegramViewer";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

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
    refetchInterval: 30_000,
  });

  const { data: participants = [] } = useQuery({
    queryKey: ["approvedRegistrants", meeting?.id],
    queryFn: () => listApproved({ data: { meetingId: meeting!.id } }),
    enabled: !!meeting?.id,
    refetchInterval: 30_000,
  });

  const [threadId, setThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const sender = useMemo(
    () => ({
      fromRole: "host" as const,
      fromName: viewer.user?.username ? `@${viewer.user.username}` : viewer.user?.first_name || "Admin",
      actorTelegramId: viewer.telegramId ?? null,
    }),
    [viewer.user?.username, viewer.user?.first_name, viewer.telegramId],
  );


  const { messages, loading, send } = useMeetingChat(meeting?.id ?? null, threadId, sender);

  if (isLoading) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading active meeting…</CardContent></Card>;
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

  const activeThread = participants.find((p: any) => p.id === threadId);

  return (
    <div className="grid gap-4 md:grid-cols-[260px_1fr]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{meeting.topic}</CardTitle>
          <CardDescription className="text-xs font-mono">#{meeting.zoom_id}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <button
            onClick={() => setThreadId(null)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm",
              threadId === null ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            <Radio className="h-4 w-4" /> Central room
          </button>
          <div className="pt-2 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Approved ({participants.length})
          </div>
          {participants.length === 0 && (
            <p className="text-xs text-muted-foreground">No approved registrants for this meeting.</p>
          )}
          {participants.map((p: any) => (
            <button
              key={p.id}
              onClick={() => setThreadId(p.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm",
                threadId === p.id ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px]">{p.name?.charAt(0) ?? "?"}</AvatarFallback>
              </Avatar>
              <span className="truncate">{p.name}</span>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="flex h-[70vh] flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm">
            {activeThread ? `1:1 · ${activeThread.name}` : "Central in-meeting chat"}
          </CardTitle>
          <Badge variant="secondary" className="text-[10px]">{messages.length} messages</Badge>
        </CardHeader>
        <CardContent className="flex-1 space-y-2 overflow-y-auto">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && messages.length === 0 && (
            <p className="text-sm text-muted-foreground">No messages yet.</p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={cn("max-w-[80%] rounded-md px-3 py-2 text-sm", m.from_role === "attendee" ? "bg-muted" : "ml-auto bg-primary text-primary-foreground")}>
              <div className="text-[11px] opacity-70">{m.from_name} · {formatDateTime(m.created_at)}</div>
              <div>{m.text}</div>
            </div>
          ))}
        </CardContent>
        <div className="flex gap-2 border-t p-3">
          <Input
            value={draft}
            placeholder="Type a message…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && draft.trim()) { send(draft); setDraft(""); }
            }}
          />
          <Button onClick={() => { if (draft.trim()) { send(draft); setDraft(""); } }}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}

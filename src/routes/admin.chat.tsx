import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, ArrowLeft, Users, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingChat } from "@/hooks/useMeetingChat";
import { getActiveMeeting } from "@/lib/meetings.functions";
import { listApprovedRegistrants } from "@/lib/messages.functions";
import { useTelegram } from "@/hooks/useTelegram";

export const Route = createFileRoute("/admin/chat")({
  ssr: false,
  component: AdminLiveChatPage,
});

type SubTab = "central" | "participants";

function AdminLiveChatPage() {
  const { user } = useTelegram();
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

  const [subTab, setSubTab] = useState<SubTab>("central");
  const [selectedRegistrantId, setSelectedRegistrantId] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState<string>("");

  const { messages, loading, send } = useMeetingChat(
    meeting?.id ?? null,
    selectedRegistrantId,
    { fromRole: "host", fromName: user?.first_name ?? "Host", actorTelegramId: user?.id },
  );

  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const openConversation = (registrantId: string | null, title: string) => {
    setSelectedRegistrantId(registrantId);
    setActiveTitle(title);
  };
  const closeConversation = () => setSelectedRegistrantId(null);

  const handleSend = async () => {
    if (!text.trim()) return;
    try {
      await send(text);
      setText("");
    } catch (e) {
      console.error(e);
    }
  };

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
        <CardContent><Link to="/admin/meetings"><Button>Go to Meetings</Button></Link></CardContent>
      </Card>
    );
  }

  // The user has opened either the central room or a 1:1 thread.
  const isChatOpen = selectedRegistrantId !== null || (subTab === "central" && activeTitle !== "");

  return (
    <Card className="flex h-[calc(100vh-14.5rem)] flex-col border border-border/50 overflow-hidden bg-card">
      <CardHeader className="border-b py-3 px-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold truncate">{meeting.topic}</CardTitle>
            <CardDescription className="text-[11px]">Zoom ID {meeting.zoom_id}</CardDescription>
          </div>
          <Badge className={meeting.status === "started" ? "bg-emerald-500 hover:bg-emerald-500" : "bg-amber-500 hover:bg-amber-500"}>
            {meeting.status === "started" ? "● Live" : meeting.status ?? "scheduled"}
          </Badge>
        </div>
      </CardHeader>

      {isChatOpen ? (
        <div className="flex flex-1 flex-col h-full bg-background/30">
          <div className="border-b py-2 px-3 flex items-center gap-2 bg-muted/10">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closeConversation}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{activeTitle}</div>
              <div className="text-[10px] text-muted-foreground">
                {selectedRegistrantId ? "1:1 with attendee" : "Central meeting chat"}
              </div>
            </div>
          </div>

          <CardContent className="flex flex-1 flex-col gap-3 p-3 overflow-hidden">
            <ScrollArea className="flex-1 pr-2" ref={scrollRef}>
              <div className="space-y-3">
                {loading && <div className="text-center text-xs text-muted-foreground">Loading…</div>}
                {!loading && messages.length === 0 && (
                  <div className="text-center text-xs text-muted-foreground py-6">No messages yet. Say hi 👋</div>
                )}
                {messages.map((m) => {
                  const mine = m.from_role === "host";
                  return (
                    <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div className="flex gap-2 max-w-[85%] items-start">
                        {!mine && (
                          <Avatar className="h-7 w-7 mt-0.5 border border-border/50">
                            <AvatarFallback className="text-[10px] bg-muted">{m.from_name.charAt(0)}</AvatarFallback>
                          </Avatar>
                        )}
                        <div className={cn("rounded-lg px-3 py-2 text-sm space-y-1", mine ? "bg-primary text-primary-foreground" : "bg-muted")}>
                          {!mine && <div className="text-[10px] opacity-80 font-bold">{m.from_name}</div>}
                          <div className="break-words whitespace-pre-wrap">{m.text}</div>
                          <div className="text-[9px] opacity-70 text-right font-mono">
                            {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="flex gap-2 pt-2 border-t border-border/50">
              <Input
                className="text-sm"
                placeholder="Type a message…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
              <Button onClick={handleSend} size="icon" className="shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </div>
      ) : (
        <div className="flex flex-1 flex-col h-full">
          <div className="flex border-b border-border/50 bg-muted/20">
            <button
              onClick={() => setSubTab("central")}
              className={cn(
                "flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2",
                subTab === "central" ? "border-primary text-primary bg-background/50" : "border-transparent text-muted-foreground hover:bg-muted/10",
              )}
            >
              <Users className="h-4 w-4" /> Central Room
            </button>
            <button
              onClick={() => setSubTab("participants")}
              className={cn(
                "flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2",
                subTab === "participants" ? "border-primary text-primary bg-background/50" : "border-transparent text-muted-foreground hover:bg-muted/10",
              )}
            >
              <MessageCircle className="h-4 w-4" /> Participants ({participants.length})
            </button>
          </div>

          <div className="flex-1 p-3 overflow-hidden">
            {subTab === "central" ? (
              <div
                onClick={() => openConversation(null, `${meeting.topic} (Central)`)}
                className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:bg-muted/20 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/20 text-primary font-bold">C</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-semibold">{meeting.topic}</div>
                    <div className="text-xs text-muted-foreground">Everyone in this meeting</div>
                  </div>
                </div>
                <Badge className="bg-emerald-500 hover:bg-emerald-500 text-[10px]">Open</Badge>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {participants.length === 0 && (
                    <div className="text-center text-xs text-muted-foreground py-6">
                      No approved participants yet.
                    </div>
                  )}
                  {participants.map((p: any) => (
                    <div
                      key={p.id}
                      onClick={() => openConversation(p.id, `1:1 · ${p.name}`)}
                      className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/20 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-primary/20 text-primary font-bold">
                            {p.name?.charAt(0) ?? "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-semibold">{p.name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {p.telegram_user ? `@${p.telegram_user}` : p.email}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[9px] capitalize">{p.status}</Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

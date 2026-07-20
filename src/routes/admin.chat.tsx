import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Send, ArrowLeft, Users, MessageCircle, Paperclip, Eye, EyeOff, Clock, Play, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLiveChat } from "@/hooks/useLiveChat";
import { getMeetingParticipants } from "@/lib/telegram-sync";
import { activeMeeting } from "@/lib/mock-data";

export const Route = createFileRoute("/admin/chat")({
  ssr: false,
  component: AdminLiveChatPage,
});

type SubTabType = "central" | "directory" | "private-1-1";
type SendMode = "permanent" | "disappearing" | "view-once";

function AdminLiveChatPage() {
  // Admin Mock Identity: Elena Ross (telegram_id: 9999)
  const adminUser = {
    id: 9999,
    first_name: "Elena",
    last_name: "Ross",
    username: "elenaross"
  };

  const [subTab, setSubTab] = useState<SubTabType>("central");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>("meeting-central");
  const [activeChatTitle, setActiveChatTitle] = useState("Weekly Strategy Sync (Central)");
  const [participants, setParticipants] = useState<any[]>([]);

  // Messages hook using Admin User ID
  const { messages, loading, send, setSeen } = useLiveChat(selectedConversationId, adminUser.id);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const [sendMode, setSendMode] = useState<SendMode>("permanent");
  const [viewOnceTimers, setViewOnceTimers] = useState<Record<string, number>>({});

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const interval = setInterval(() => {
      setViewOnceTimers((prev) => {
        const next = { ...prev };
        let updated = false;
        Object.keys(next).forEach((id) => {
          if (next[id] > 0) {
            next[id] -= 1;
            updated = true;
          }
        });
        return updated ? next : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Load meeting participants (exclude admin self)
  useEffect(() => {
    async function loadParticipants() {
      const fetched = await getMeetingParticipants(activeMeeting.id, adminUser.id);
      setParticipants(fetched.length > 0 ? fetched : [
        {
          telegram_id: 1111,
          status: "joined",
          user: { first_name: "Bruno", last_name: "Silva", username: "brunos", photo_url: null }
        },
        {
          telegram_id: 2222,
          status: "approved",
          user: { first_name: "Alice", last_name: "Johnson", username: "alicej", photo_url: null }
        }
      ]);
    }
    loadParticipants();
  }, []);

  const handleSend = (media?: { url: string; type: string }) => {
    if (!media && !text.trim()) return;

    let mediaOptions = undefined;
    if (media) {
      mediaOptions = {
        url: media.url,
        type: media.type,
        isViewOnce: sendMode === "view-once",
        expiresSeconds: sendMode === "disappearing" ? 10 : undefined,
      };
    }

    send(media ? "" : text, adminUser.first_name, mediaOptions);
    setText("");
    setSendMode("permanent");
  };

  const sendMockMedia = (type: "image" | "video") => {
    const url = type === "image"
      ? "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&auto=format&fit=crop"
      : "https://www.w3schools.com/html/mov_bbb.mp4";
    handleSend({ url, type });
  };

  const openPrivateMeetingChat = (participantId: number, title: string) => {
    setSelectedConversationId(`private-meet-${participantId}`);
    setActiveChatTitle(`Private with: ${title}`);
  };

  const closeChatWindow = () => {
    setSelectedConversationId(null);
  };

  const revealViewOnce = (msgId: string) => {
    setSeen(msgId);
    setViewOnceTimers((prev) => ({ ...prev, [msgId]: 5 }));
  };

  return (
    <Card className="flex h-[calc(100vh-14.5rem)] flex-col border border-border/50 overflow-hidden bg-card">
      {selectedConversationId ? (
        /* Active Chat Room */
        <div className="flex flex-1 flex-col h-full bg-background/30">
          <CardHeader className="border-b py-3 px-4 flex flex-row items-center gap-3 bg-muted/10">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={closeChatWindow}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-sm font-semibold truncate">{activeChatTitle}</CardTitle>
              <CardDescription className="text-[10px] truncate">Admin Live Chat View</CardDescription>
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] px-1.5 py-0.5">● Live</Badge>
          </CardHeader>

          <CardContent className="flex flex-1 flex-col gap-3 p-3 overflow-hidden">
            <ScrollArea className="flex-1 pr-2" ref={scrollRef}>
              <div className="space-y-3">
                {messages.map((m) => {
                  const mine = m.sender_telegram_id === adminUser.id;
                  const secondsLeft = m.expires_at ? Math.max(0, Math.ceil((new Date(m.expires_at).getTime() - Date.now()) / 1000)) : null;
                  const isViewOnceExpired = m.is_view_once && m.view_once_seen && viewOnceTimers[m.id] === 0;

                  return (
                    <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div className="flex gap-2 max-w-[85%] items-start">
                        {!mine && (
                          <Avatar className="h-7 w-7 mt-0.5 border border-border/50">
                            {m.sender.photo_url ? <AvatarImage src={m.sender.photo_url} /> : null}
                            <AvatarFallback className="text-[10px] bg-muted">{m.sender.first_name.charAt(0)}</AvatarFallback>
                          </Avatar>
                        )}
                        <div className={cn("rounded-lg px-3 py-2 text-sm space-y-1.5 relative overflow-hidden", mine ? "bg-primary text-primary-foreground" : "bg-muted")}>
                          {!mine && (
                            <div className="flex items-center gap-1.5 text-[10px] opacity-80 font-bold">
                              <span>{m.sender.first_name}</span>
                            </div>
                          )}

                          {m.media_url ? (
                            isViewOnceExpired ? (
                              <div className="flex items-center gap-2 p-2 bg-black/40 rounded border border-border/50 text-[11px] text-muted-foreground/80 italic font-mono">
                                <EyeOff className="h-4 w-4 text-red-500" /> Opened - Media deleted
                              </div>
                            ) : m.is_view_once && !m.view_once_seen ? (
                              <div
                                onClick={() => revealViewOnce(m.id)}
                                className="flex flex-col items-center justify-center p-4 bg-black/50 border border-dashed border-primary/50 hover:bg-black/75 rounded cursor-pointer transition-colors space-y-1.5 w-44"
                              >
                                <Eye className="h-6 w-6 text-primary animate-pulse" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Tap to view</span>
                                <span className="text-[8px] text-muted-foreground">Expires on open</span>
                              </div>
                            ) : (
                              <div className="relative rounded overflow-hidden max-w-[200px] border border-black/20">
                                {m.media_type === "image" ? (
                                  <img src={m.media_url} alt="Shared media" className="object-cover w-full h-28" />
                                ) : (
                                  <div className="relative flex items-center justify-center bg-black h-28 w-44">
                                    <Play className="absolute h-8 w-8 text-white/80 bg-black/50 p-1.5 rounded-full" />
                                    <video src={m.media_url} className="w-full h-full object-cover" muted loop />
                                  </div>
                                )}

                                {secondsLeft !== null && (
                                  <div className="absolute top-1 right-1 bg-red-600 text-white font-mono text-[9px] px-1 rounded flex items-center gap-0.5 shadow-md">
                                    <Clock className="h-2.5 w-2.5" /> {secondsLeft}s
                                  </div>
                                )}

                                {m.is_view_once && m.view_once_seen && viewOnceTimers[m.id] !== undefined && (
                                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-[10px] text-white space-y-1">
                                    <EyeOff className="h-5 w-5 text-red-500" />
                                    <span className="font-bold text-red-400">Self-destructing...</span>
                                    <span className="font-mono text-xs">{viewOnceTimers[m.id]}s</span>
                                  </div>
                                )}
                              </div>
                            )
                          ) : null}

                          {m.content && <div className="break-all">{m.content}</div>}

                          <div className="flex items-center justify-between gap-4 text-[9px] opacity-80 pt-0.5">
                            <div>
                              {m.is_view_once && !isViewOnceExpired && (
                                <Badge className="bg-red-500/30 text-red-400 hover:bg-red-500/30 text-[8px] h-3.5 px-1 py-0">View Once</Badge>
                              )}
                              {secondsLeft !== null && !m.media_url && (
                                <span className="text-red-400 flex items-center gap-0.5"><Clock className="h-2 w-2" /> Disappearing in {secondsLeft}s</span>
                              )}
                            </div>
                            <span className="font-mono">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                  {loading && <div className="text-center text-xs text-muted-foreground">Loading messages...</div>}
                </div>
              </ScrollArea>

              <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
                {sendMode !== "permanent" && (
                  <div className="flex items-center justify-between px-2 py-1 bg-primary/10 border border-primary/20 rounded text-[10px] text-primary font-semibold">
                    <span className="flex items-center gap-1">
                      {sendMode === "disappearing" ? <Clock className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      Mode: {sendMode === "disappearing" ? "Self-Destruct (10s)" : "View Once"}
                    </span>
                    <button onClick={() => setSendMode("permanent")} className="underline hover:text-primary-foreground">Cancel</button>
                  </div>
                )}

                <div className="flex gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="shrink-0 bg-black/10 border-border/50">
                        <Paperclip className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-background/95 border-border/50">
                      <DropdownMenuLabel className="text-xs">Send Media Mode</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => setSendMode("permanent")} className="text-xs flex items-center gap-2">
                        Normal (Permanent)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSendMode("disappearing")} className="text-xs flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-red-500" /> Disappearing (10s)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSendMode("view-once")} className="text-xs flex items-center gap-2">
                        <Eye className="h-3.5 w-3.5 text-orange-500" /> View Once
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-border/50" />
                      <DropdownMenuLabel className="text-xs">Mock Media</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => sendMockMedia("image")} className="text-xs">🖼️ Sunset Photo</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => sendMockMedia("video")} className="text-xs">📹 Bunny Video</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Input
                    className="bg-black/20 border-border/50 text-sm focus:ring-0"
                    placeholder="Type a message…"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  />
                  <Button onClick={() => handleSend()} size="icon" className="shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </div>
      ) : (
        /* Listing sub-tabs */
        <div className="flex flex-1 flex-col h-full">
          <div className="flex border-b border-border/50 bg-muted/20">
            <button
              onClick={() => setSubTab("central")}
              className={cn(
                "flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2",
                subTab === "central" ? "border-primary text-primary bg-background/50" : "border-transparent text-muted-foreground hover:bg-muted/10"
              )}
            >
              <Users className="h-4 w-4" /> Central Room
            </button>
            <button
              onClick={() => setSubTab("directory")}
              className={cn(
                "flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2",
                subTab === "directory" ? "border-primary text-primary bg-background/50" : "border-transparent text-muted-foreground hover:bg-muted/10"
              )}
            >
              <MessageCircle className="h-4 w-4" /> Participants
            </button>
            <button
              onClick={() => setSubTab("private-1-1")}
              className={cn(
                "flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2",
                subTab === "private-1-1" ? "border-primary text-primary bg-background/50" : "border-transparent text-muted-foreground hover:bg-muted/10"
              )}
            >
              <Lock className="h-4 w-4" /> Private 1:1s
            </button>
          </div>

          <div className="flex-1 p-3 overflow-hidden">
            {subTab === "central" ? (
              <div className="space-y-2">
                <div
                  onClick={() => {
                    setSelectedConversationId("meeting-central");
                    setActiveChatTitle(`${activeMeeting.topic} (Central)`);
                  }}
                  className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:bg-muted/20 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 bg-primary/20 text-primary font-bold">
                      <AvatarFallback>C</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-semibold">{activeMeeting.topic}</div>
                      <div className="text-xs text-muted-foreground">Live group chat</div>
                    </div>
                  </div>
                  <Badge className="bg-emerald-500 hover:bg-emerald-500 text-[10px]">Live</Badge>
                </div>
              </div>
            ) : subTab === "directory" ? (
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {participants.map((p) => (
                    <div
                      key={p.telegram_id}
                      onClick={() => openPrivateMeetingChat(p.telegram_id, p.user.first_name)}
                      className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/20 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 bg-primary/20 text-primary font-bold">
                          <AvatarFallback>{p.user.first_name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-semibold">{p.user.first_name}</div>
                          <div className="text-[10px] text-muted-foreground">@{p.user.username || "username"}</div>
                        </div>
                      </div>
                      <Button size="sm" variant="secondary" className="text-[10px] h-7 px-2">Chat</Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  <div
                    onClick={() => openPrivateMeetingChat(1111, "Bruno")}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/20 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 bg-primary/20 text-primary font-bold">
                        <AvatarFallback>B</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-semibold">Bruno</div>
                        <div className="text-[10px] text-muted-foreground">Last message: Audio is clear...</div>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[9px]">Private</Badge>
                  </div>
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

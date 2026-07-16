import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getMyRegistration } from "@/lib/registrants.functions";
import { listThreadMessages, sendChatMessage } from "@/lib/messages.functions";
import { formatTime } from "@/lib/format";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTelegramViewer } from "@/hooks/useTelegramViewer";
import { toast } from "sonner";

export const Route = createFileRoute("/app/chat")({
  ssr: false,
  component: ChatPage,
});

function ChatPage() {
  const { telegramId } = useTelegramViewer();
  const qc = useQueryClient();
  const reg = useQuery({
    queryKey: ["myReg", telegramId],
    queryFn: () => getMyRegistration({ data: { telegramId: telegramId! } }),
    enabled: !!telegramId,
  });
  const registrantId = (reg.data as any)?.id as string | undefined;
  const meeting = (reg.data as any)?.meetings;

  const messages = useQuery({
    queryKey: ["thread", registrantId],
    queryFn: () => listThreadMessages({ data: { registrantId: registrantId! } }),
    enabled: !!registrantId,
    refetchInterval: 3000,
  });

  const [text, setText] = useState("");
  const send = useMutation({
    mutationFn: (t: string) => sendChatMessage({ data: { registrantId: registrantId!, text: t, fromRole: "attendee", actorTelegramId: telegramId } }),
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: ["thread", registrantId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="flex h-[calc(100vh-11rem)] flex-col">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Live meeting chat</CardTitle>
            <CardDescription>{meeting?.topic ?? "—"}</CardDescription>
          </div>
          {meeting && <Badge className="bg-emerald-500 hover:bg-emerald-500">● Live</Badge>}
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 p-3">
        {!telegramId ? (
          <p className="text-sm text-muted-foreground">Open the app from Telegram to chat.</p>
        ) : !registrantId ? (
          <p className="text-sm text-muted-foreground">
            You need to <Link to="/app" className="underline">register</Link> first.
          </p>
        ) : (
          <>
            <ScrollArea className="flex-1 pr-2">
              <div className="space-y-3">
                {(messages.data ?? []).map((m) => {
                  const mine = m.from_role === "attendee";
                  return (
                    <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div className={cn("max-w-[80%] rounded-lg px-3 py-2 text-sm", mine ? "bg-primary text-primary-foreground" : "bg-muted")}>
                        {!mine && (
                          <div className="mb-0.5 flex items-center gap-1.5 text-xs opacity-80">
                            <span className="font-semibold">{m.from_name}</span>
                            <Badge variant="outline" className="h-4 px-1 text-[10px]">Host</Badge>
                          </div>
                        )}
                        <div>{m.text}</div>
                        <div className={cn("mt-0.5 text-[10px]", mine ? "opacity-80" : "text-muted-foreground")}>{formatTime(m.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            <div className="flex gap-2">
              <Input placeholder="Type a message…" value={text} onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && text.trim() && send.mutate(text)} />
              <Button onClick={() => text.trim() && send.mutate(text)} disabled={send.isPending}><Send className="h-4 w-4" /></Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

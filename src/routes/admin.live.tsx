import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getActiveMeeting } from "@/lib/meetings.functions";
import { listRegistrants } from "@/lib/registrants.functions";
import { listThreadMessages, sendChatMessage } from "@/lib/messages.functions";
import { formatTime } from "@/lib/format";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTelegramViewer } from "@/hooks/useTelegramViewer";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/live")({
  ssr: false,
  component: LivePage,
});

function LivePage() {
  const { telegramId } = useTelegramViewer();
  const qc = useQueryClient();
  const active = useQuery({ queryKey: ["activeMeeting"], queryFn: () => getActiveMeeting() });
  const registrants = useQuery({ queryKey: ["registrants"], queryFn: () => listRegistrants(), refetchInterval: 5000 });
  const attended = (registrants.data ?? []).filter((r) => r.status === "approved" || r.status === "attended");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeId = selectedId ?? attended[0]?.id ?? null;

  const messages = useQuery({
    queryKey: ["thread", activeId],
    queryFn: () => (activeId ? listThreadMessages({ data: { registrantId: activeId } }) : Promise.resolve([])),
    enabled: !!activeId,
    refetchInterval: 3000,
  });

  const [text, setText] = useState("");
  const send = useMutation({
    mutationFn: (t: string) => sendChatMessage({ data: { registrantId: activeId!, text: t, fromRole: "host", actorTelegramId: telegramId } }),
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: ["thread", activeId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const selected = attended.find((r) => r.id === activeId);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>{active.data?.topic ?? "No active meeting"}</CardTitle>
            <CardDescription>{active.data ? `Meeting ID ${active.data.zoom_id}` : "Sync a meeting to start"}</CardDescription>
          </div>
          {active.data && <Badge className="bg-emerald-500 hover:bg-emerald-500">● Live</Badge>}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="aspect-video overflow-hidden rounded-md bg-gradient-to-br from-slate-800 to-slate-950 p-6 text-slate-100">
            <div className="flex h-full flex-col justify-between">
              <div className="text-xs opacity-70">Live preview</div>
              <div>
                <div className="text-2xl font-semibold">{active.data?.host_email ?? "Host"}</div>
                <div className="text-sm opacity-70">{attended.length} approved attendee{attended.length === 1 ? "" : "s"}</div>
              </div>
            </div>
          </div>
          <div>
            <div className="mb-2 text-sm font-medium">Attendees ({attended.length})</div>
            <div className="flex flex-wrap gap-2">
              {attended.map((a) => (
                <Badge key={a.id} variant={a.id === activeId ? "default" : "secondary"} className="cursor-pointer" onClick={() => setSelectedId(a.id)}>
                  {a.name}
                </Badge>
              ))}
              {attended.length === 0 && <p className="text-sm text-muted-foreground">No approved attendees yet.</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle>1:1 chat</CardTitle>
          <CardDescription>{selected ? `Thread with ${selected.name}` : "Pick an attendee"}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3">
          <ScrollArea className="h-80 rounded-md border p-3">
            <div className="space-y-3">
              {(messages.data ?? []).map((m) => (
                <div key={m.id} className={cn("space-y-0.5", m.from_role === "host" && "text-right")}>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold">{m.from_name}</span>
                    {m.from_role === "host" && <Badge variant="outline" className="h-4 px-1 text-[10px]">Host</Badge>}
                    <span className="text-muted-foreground">{formatTime(m.created_at)}</span>
                  </div>
                  <div className="text-sm">{m.text}</div>
                </div>
              ))}
              {(messages.data ?? []).length === 0 && selected && (
                <p className="text-sm text-muted-foreground">No messages yet in this thread.</p>
              )}
            </div>
          </ScrollArea>
          <div className="flex gap-2">
            <Input placeholder={selected ? `Message ${selected.name}…` : "Pick an attendee first"} disabled={!selected}
              value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && text.trim() && send.mutate(text)} />
            <Button onClick={() => text.trim() && send.mutate(text)} disabled={!selected || send.isPending}><Send className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { activeMeeting, chatMessages as seed, registrants, type ChatMessage } from "@/lib/mock-data";
import { Send, MicOff, VideoOff } from "lucide-react";

export const Route = createFileRoute("/admin/live")({
  component: LivePage,
});

function LivePage() {
  const [msgs, setMsgs] = useState<ChatMessage[]>(seed);
  const [text, setText] = useState("");
  const attended = registrants.filter((r) => r.status === "approved" || r.status === "attended");

  const send = () => {
    if (!text.trim()) return;
    setMsgs((m) => [...m, {
      id: `c${m.length + 1}`, from: "Elena Ross", role: "host", text, at: new Date().toISOString(),
    }]);
    setText("");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>{activeMeeting.topic}</CardTitle>
            <CardDescription>Meeting ID {activeMeeting.id}</CardDescription>
          </div>
          <Badge className="bg-emerald-500 hover:bg-emerald-500">● Live</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="aspect-video overflow-hidden rounded-md bg-gradient-to-br from-slate-800 to-slate-950 p-6 text-slate-100">
            <div className="flex h-full flex-col justify-between">
              <div className="text-xs opacity-70">Live preview</div>
              <div>
                <div className="text-2xl font-semibold">{activeMeeting.host}</div>
                <div className="text-sm opacity-70">Speaking · {activeMeeting.attendees} attendees</div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline"><MicOff className="h-4 w-4" /> Mute all</Button>
            <Button variant="outline"><VideoOff className="h-4 w-4" /> Stop video</Button>
            <Button variant="destructive">End meeting</Button>
          </div>
          <div>
            <div className="mb-2 text-sm font-medium">Attendees ({attended.length})</div>
            <div className="flex flex-wrap gap-2">
              {attended.map((a) => (
                <Badge key={a.id} variant="secondary">{a.name}</Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle>In-meeting chat</CardTitle>
          <CardDescription>Broadcast to attendees</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3">
          <ScrollArea className="h-80 rounded-md border p-3">
            <div className="space-y-3">
              {msgs.map((m) => (
                <div key={m.id} className="space-y-0.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold">{m.from}</span>
                    {m.role === "host" && <Badge variant="outline" className="h-4 px-1 text-[10px]">Host</Badge>}
                    <span className="text-muted-foreground">{new Date(m.at).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-sm">{m.text}</div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="flex gap-2">
            <Input
              placeholder="Message attendees…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            <Button onClick={send}><Send className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

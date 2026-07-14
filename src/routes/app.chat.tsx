import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { chatMessages as seed, type ChatMessage } from "@/lib/mock-data";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/chat")({
  component: ChatPage,
});

function ChatPage() {
  const [msgs, setMsgs] = useState<ChatMessage[]>(seed);
  const [text, setText] = useState("");

  const send = () => {
    if (!text.trim()) return;
    setMsgs((m) => [...m, {
      id: `me${m.length + 1}`, from: "You", role: "attendee", text, at: new Date().toISOString(),
    }]);
    setText("");
  };

  return (
    <Card className="flex h-[calc(100vh-11rem)] flex-col">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Live meeting chat</CardTitle>
            <CardDescription>Weekly Strategy Sync</CardDescription>
          </div>
          <Badge className="bg-emerald-500 hover:bg-emerald-500">● Live</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 p-3">
        <ScrollArea className="flex-1 pr-2">
          <div className="space-y-3">
            {msgs.map((m) => {
              const mine = m.from === "You";
              return (
                <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[80%] rounded-lg px-3 py-2 text-sm", mine ? "bg-primary text-primary-foreground" : "bg-muted")}>
                    {!mine && (
                      <div className="mb-0.5 flex items-center gap-1.5 text-xs opacity-80">
                        <span className="font-semibold">{m.from}</span>
                        {m.role === "host" && <Badge variant="outline" className="h-4 px-1 text-[10px]">Host</Badge>}
                      </div>
                    )}
                    <div>{m.text}</div>
                    <div className={cn("mt-0.5 text-[10px]", mine ? "opacity-80" : "text-muted-foreground")}>
                      {new Date(m.at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
        <div className="flex gap-2">
          <Input
            placeholder="Type a message…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
          />
          <Button onClick={send}><Send className="h-4 w-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

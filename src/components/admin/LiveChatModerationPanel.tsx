import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trash2, Megaphone, ShieldAlert, CheckCircle2, AlertTriangle, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LiveMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
  isFlagged?: boolean;
}

const initialMockMessages: LiveMessage[] = [
  { id: "m1", sender: "Somsak Jaidee", text: "สวัสดีครับ ขอไฟล์สไลด์ประกอบการสอนด้วยครับ", time: "09:05:10" },
  { id: "m2", sender: "Anon User", text: "เว็บพนันออนไลน์ สมัครฟรี คลิก bit.ly/spam123", time: "09:08:44", isFlagged: true },
  { id: "m3", sender: "Nipon Tech", text: "เสียงอาจารย์ชัดเจนดีครับ", time: "09:12:00" },
  { id: "m4", sender: "Unknown Guest", text: "ติดต่อแอดมินด่วน lineid: @badspam", time: "09:15:30", isFlagged: true },
];

export function LiveChatModerationPanel() {
  const [messages, setMessages] = useState<LiveMessage[]>(initialMockMessages);
  const [announcementText, setAnnouncementText] = useState("");
  const [autoFilter, setAutoFilter] = useState(true);

  // 1-Click Message Deletion
  const handleDeleteMessage = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    toast.success("ข้อความถูกลบออกจาก Zoom Live Chat เรียบร้อยแล้ว");
  };

  // Broadcast Announcement
  const handleBroadcast = () => {
    if (!announcementText.trim()) return;
    toast.success(`ส่งข้อความประกาศเข้า Zoom Live Chat เรียบร้อย: "${announcementText}"`);
    setAnnouncementText("");
  };

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/20 text-red-400">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">Live Chat Moderation Panel</CardTitle>
            <CardDescription className="text-xs">Real-time Zoom Live Chat Control & 1-Click Delete</CardDescription>
          </div>
        </div>

        {/* Auto Moderation Toggle */}
        <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-1.5 text-xs">
          <span className="font-semibold text-muted-foreground">Auto-Filter Spam:</span>
          <Switch checked={autoFilter} onCheckedChange={setAutoFilter} />
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Broadcast Announcement Bar */}
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary">
            <Megaphone className="h-4 w-4" /> Broadcast Announcement to Zoom Live Chat
          </div>
          <div className="flex gap-2">
            <Input
              value={announcementText}
              onChange={(e) => setAnnouncementText(e.target.value)}
              placeholder="พิมพ์ข้อความประกาศส่งปักหมุดเข้า Zoom..."
              className="bg-background/80 border-border/50 text-xs focus:ring-0"
              onKeyDown={(e) => e.key === "Enter" && handleBroadcast()}
            />
            <Button size="sm" onClick={handleBroadcast} className="text-xs shrink-0">
              <Send className="h-3.5 w-3.5 mr-1" /> Broadcast
            </Button>
          </div>
        </div>

        {/* Real-time Message Moderation Stream */}
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex justify-between items-center">
            <span>Incoming Live Messages ({messages.length})</span>
            <span className="text-[10px] text-emerald-400">● Live Stream Connected</span>
          </div>

          <ScrollArea className="h-64 rounded-lg border border-border/50 bg-black/20 p-2">
            <div className="space-y-2">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors",
                    m.isFlagged
                      ? "border-red-500/40 bg-red-500/10"
                      : "border-border/40 bg-background/50 hover:bg-muted/20"
                  )}
                >
                  <div className="flex items-start gap-2.5 min-w-0 pr-2">
                    <Avatar className="h-7 w-7 mt-0.5 border border-border/50 shrink-0">
                      <AvatarFallback className="text-[10px] bg-muted font-bold">
                        {m.sender.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs truncate">{m.sender}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{m.time}</span>
                        {m.isFlagged && (
                          <Badge className="bg-red-500/20 text-red-400 border border-red-500/30 text-[9px] px-1 py-0 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Flagged Spam
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground text-xs mt-0.5 break-words">{m.text}</p>
                    </div>
                  </div>

                  {/* 1-Click Delete Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteMessage(m.id)}
                    className="h-8 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 shrink-0"
                    title="ลบข้อความนี้ใน Zoom Live Chat"
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
                </div>
              ))}

              {messages.length === 0 && (
                <div className="p-8 text-center text-xs text-muted-foreground italic">
                  No live messages currently streaming.
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}

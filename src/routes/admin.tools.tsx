import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Megaphone, KeyRound, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { syncActiveMeeting } from "@/lib/meetings.functions";
import { broadcastToApproved } from "@/lib/viewer.functions";
import { useTelegramViewer } from "@/hooks/useTelegramViewer";

export const Route = createFileRoute("/admin/tools")({
  ssr: false,
  component: ToolsPage,
});

function ToolsPage() {
  const { telegramId } = useTelegramViewer();
  const qc = useQueryClient();
  const [broadcast, setBroadcast] = useState("");
  const [zoomId, setZoomId] = useState("");

  const send = useMutation({
    mutationFn: () => broadcastToApproved({ data: { text: broadcast, actorTelegramId: telegramId ?? 0 } }),
    onSuccess: (r) => { toast.success(`Broadcast sent to ${r.sent}/${r.total}`); setBroadcast(""); qc.invalidateQueries({ queryKey: ["audit"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const setActive = useMutation({
    mutationFn: () => syncActiveMeeting({ data: { meetingId: zoomId || undefined, actorTelegramId: telegramId } }),
    onSuccess: () => { toast.success("Active meeting updated"); setZoomId(""); qc.invalidateQueries({ queryKey: ["activeMeeting"] }); qc.invalidateQueries({ queryKey: ["meetings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /><CardTitle>Broadcast</CardTitle></div>
          <CardDescription>Send a Telegram message to all approved registrants</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea rows={4} placeholder="Your message…" value={broadcast} onChange={(e) => setBroadcast(e.target.value)} />
          <Button className="w-full" onClick={() => broadcast.trim() && send.mutate()} disabled={send.isPending}>Send broadcast</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /><CardTitle>Set active meeting</CardTitle></div>
          <CardDescription>Syncs from Zoom and marks it as the active meeting</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Zoom meeting ID (leave empty to use env default)</Label>
            <Input placeholder="83483016779" className="font-mono" value={zoomId} onChange={(e) => setZoomId(e.target.value)} />
          </div>
          <Button className="w-full" variant="secondary" onClick={() => setActive.mutate()} disabled={setActive.isPending}>
            <RefreshCw className="h-4 w-4" /> Sync & set active
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

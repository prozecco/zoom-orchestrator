import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Megaphone, KeyRound, RefreshCw, Zap, Video, Eye, EyeOff, CheckCircle2, ShieldCheck, Link2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { syncActiveMeeting, syncUpcomingMeetings } from "@/lib/meetings.functions";
import { broadcastToApproved, registerTelegramWebhook } from "@/lib/viewer.functions";
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
  const [showSecret, setShowSecret] = useState(false);

  // Editable / Displayed Zoom Configuration State
  const [zoomAccountId, setZoomAccountId] = useState("Xmxl4CRXRLqrvr3WXlUqAw");
  const [zoomClientId, setZoomClientId] = useState("KJVgvj9TQHOT5oIBkl6Z7g");
  const [zoomClientSecret, setZoomClientSecret] = useState("z8S2uY85DqUFI2UdexFfd179MsBhcM6z");
  const [zoomDefaultMeetingId, setZoomDefaultMeetingId] = useState("83483016779");
  const [zoomRegLink, setZoomRegLink] = useState("https://us06web.zoom.us/meeting/register/xHiSkLTMQLq0an5MdrWlZw");
  const [zoomWebhookSecret, setZoomWebhookSecret] = useState("YYJPbMz0Q6GazVd_DeBMIQ");

  const send = useMutation({
    mutationFn: () => broadcastToApproved({ data: { text: broadcast, actorTelegramId: telegramId ?? 0 } }),
    onSuccess: (r) => { toast.success(`Broadcast sent to ${r.sent}/${r.total}`); setBroadcast(""); qc.invalidateQueries({ queryKey: ["audit"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const setActive = useMutation({
    mutationFn: () => syncActiveMeeting({ data: { meetingId: zoomId || zoomDefaultMeetingId || undefined, actorTelegramId: telegramId } }),
    onSuccess: () => { toast.success("Active meeting updated from Zoom API"); setZoomId(""); qc.invalidateQueries({ queryKey: ["activeMeeting"] }); qc.invalidateQueries({ queryKey: ["meetings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const syncAllUpcoming = useMutation({
    mutationFn: () => syncUpcomingMeetings({ data: { actorTelegramId: telegramId } }),
    onSuccess: (r) => { toast.success(`Successfully synced ${r.count} meetings from Zoom API!`); qc.invalidateQueries({ queryKey: ["meetings"] }); qc.invalidateQueries({ queryKey: ["activeMeeting"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const registerHook = useMutation({
    mutationFn: () => {
      const url = `${window.location.origin}/api/public/telegram/webhook`;
      return registerTelegramWebhook({ data: { webhookUrl: url, actorTelegramId: telegramId ?? 0 } });
    },
    onSuccess: () => toast.success("Telegram webhook registered"),
    onError: (e: Error) => toast.error(e.message),
  });

  const handleTestZoomOAuth = () => {
    toast.promise(
      syncActiveMeeting({ data: { meetingId: zoomDefaultMeetingId, actorTelegramId: telegramId } }),
      {
        loading: "Testing Zoom Server-to-Server OAuth credentials...",
        success: "Zoom OAuth Connected & Meeting Synced successfully!",
        error: (err: any) => `Zoom Connection Error: ${err.message || "Failed to authenticate with Zoom API"}`,
      }
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Zoom API Configuration & Credentials Card */}
      <Card className="lg:col-span-2 border-emerald-500/30 bg-emerald-500/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Video className="h-5 w-5 text-emerald-500" />
              <CardTitle>Zoom API Configuration</CardTitle>
            </div>
            <Badge className="bg-emerald-500 text-white font-medium text-xs px-2.5 py-0.5 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Server-to-Server OAuth Active
            </Badge>
          </div>
          <CardDescription>
            Manage your Zoom Account Credentials, Default Meeting ID, and test OAuth API synchronization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">ZOOM_ACCOUNT_ID</Label>
              <Input
                value={zoomAccountId}
                onChange={(e) => setZoomAccountId(e.target.value)}
                className="font-mono text-xs bg-background"
                placeholder="Xmxl4CRXRLqrvr3WXlUqAw"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">ZOOM_CLIENT_ID</Label>
              <Input
                value={zoomClientId}
                onChange={(e) => setZoomClientId(e.target.value)}
                className="font-mono text-xs bg-background"
                placeholder="KJVgvj9TQHOT5oIBkl6Z7g"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">ZOOM_CLIENT_SECRET</Label>
              <div className="relative">
                <Input
                  type={showSecret ? "text" : "password"}
                  value={zoomClientSecret}
                  onChange={(e) => setZoomClientSecret(e.target.value)}
                  className="font-mono text-xs bg-background pr-10"
                  placeholder="z8S2uY85DqUFI2UdexFfd179MsBhcM6z"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">ZOOM_MEETING_ID (Default)</Label>
              <Input
                value={zoomDefaultMeetingId}
                onChange={(e) => setZoomDefaultMeetingId(e.target.value)}
                className="font-mono text-xs bg-background"
                placeholder="83483016779"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">ZOOM_WEBHOOK_SECRET</Label>
              <Input
                value={zoomWebhookSecret}
                onChange={(e) => setZoomWebhookSecret(e.target.value)}
                className="font-mono text-xs bg-background"
                placeholder="YYJPbMz0Q6GazVd_DeBMIQ"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">ZOOM_REGISTRATION_LINK</Label>
              <div className="flex gap-2">
                <Input
                  value={zoomRegLink}
                  onChange={(e) => setZoomRegLink(e.target.value)}
                  className="font-mono text-xs bg-background"
                  placeholder="https://us06web.zoom.us/meeting/register/..."
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(zoomRegLink, "_blank")}
                  className="shrink-0 text-xs"
                >
                  <Link2 className="h-3.5 w-3.5 mr-1" /> Open
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
            <Button
              size="sm"
              onClick={handleTestZoomOAuth}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex items-center gap-1.5"
            >
              <ShieldCheck className="h-4 w-4" /> Test Zoom OAuth & Sync Active
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => syncAllUpcoming.mutate()}
              disabled={syncAllUpcoming.isPending}
              className="text-xs flex items-center gap-1.5 border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", syncAllUpcoming.isPending && "animate-spin")} /> Sync All Zoom Meetings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Broadcast Card */}
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

      {/* Set Active Meeting Card */}
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
            <RefreshCw className="h-4 w-4 mr-1.5" /> Sync & set active
          </Button>
        </CardContent>
      </Card>

      {/* Telegram Webhook Card */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary" /><CardTitle>Telegram webhook</CardTitle></div>
          <CardDescription>Point the bot at this app so /start opens the right Mini App.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => registerHook.mutate()} disabled={registerHook.isPending}>
            Register webhook for this app
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

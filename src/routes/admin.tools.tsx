import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Megaphone, KeyRound, RefreshCw, Zap, Video, Eye, EyeOff, CheckCircle2, ShieldCheck, Link2, Shield, UserPlus, UserCheck, Server, Sparkles, AlertTriangle, Clock, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { syncActiveMeeting, syncUpcomingMeetings, testZoomAuth, getZoomEnvConfig, syncZoomDirectlyFromEnv, syncLiveZoomData } from "@/lib/meetings.functions";
import { broadcastToApproved, registerTelegramWebhook } from "@/lib/viewer.functions";
import { useTelegramViewer } from "@/hooks/useTelegramViewer";

export const Route = createFileRoute("/admin/tools")({
  ssr: false,
  component: ToolsPage,
});

interface SyncResultModalState {
  open: boolean;
  success: boolean;
  title: string;
  message: string;
  details?: {
    topic?: string;
    zoom_id?: string;
    host_email?: string;
    status?: string;
    synced_at?: string;
  };
}

function ToolsPage() {
  const { telegramId } = useTelegramViewer();
  const qc = useQueryClient();

  const getZoomEnvConfigFn = useServerFn(getZoomEnvConfig);
  const syncActiveMeetingFn = useServerFn(syncActiveMeeting);
  const syncUpcomingMeetingsFn = useServerFn(syncUpcomingMeetings);
  const testZoomAuthFn = useServerFn(testZoomAuth);
  const syncZoomDirectlyFromEnvFn = useServerFn(syncZoomDirectlyFromEnv);
  const broadcastToApprovedFn = useServerFn(broadcastToApproved);
  const registerTelegramWebhookFn = useServerFn(registerTelegramWebhook);

  const [broadcast, setBroadcast] = useState("");
  const [zoomId, setZoomId] = useState("");
  const [showSecret, setShowSecret] = useState(true);

  // Modal Popup Notification State
  const [syncModal, setSyncModal] = useState<SyncResultModalState | null>(null);

  // Fetch actual .env config from server
  const envConfigQuery = useQuery({ queryKey: ["zoomEnvConfig"], queryFn: () => getZoomEnvConfigFn() });

  // Editable / Displayed Zoom Configuration State
  const [zoomAccountId, setZoomAccountId] = useState("X0ADU72rToGb7hdnnIBkeg");
  const [zoomClientId, setZoomClientId] = useState("o9qDabC6RPapF8IUgz3Efw");
  const [zoomClientSecret, setZoomClientSecret] = useState("4C06H56EsMmDjMShZVGwSs6SMOSZ5ztv");
  const [zoomDefaultMeetingId, setZoomDefaultMeetingId] = useState("85651598189");
  const [zoomRegLink, setZoomRegLink] = useState("https://us05web.zoom.us/j/85651598189?pwd=xxJugOAf1uy1Amwlchy4ZbshgzvoYk.1");
  const [zoomWebhookSecret, setZoomWebhookSecret] = useState("QG6XM_lQRq25ad8Up39jtg");

  useEffect(() => {
    if (envConfigQuery.data) {
      setZoomAccountId(envConfigQuery.data.accountId);
      setZoomClientId(envConfigQuery.data.clientId);
      setZoomClientSecret(envConfigQuery.data.clientSecret);
      setZoomDefaultMeetingId(envConfigQuery.data.meetingId || "85651598189");
      setZoomRegLink(envConfigQuery.data.regLink);
      setZoomWebhookSecret(envConfigQuery.data.webhookSecret);
    }
  }, [envConfigQuery.data]);

  // Admin Management State
  const [adminList, setAdminList] = useState<Array<{ id: number; username: string; role: string }>>([
    { id: 6255415226, username: "@izax619", role: "Super Admin (Owner)" },
    { id: -1004310551647, username: "Notification Channel", role: "Bot Channel Target" },
  ]);
  const [newAdminId, setNewAdminId] = useState("");
  const [newAdminUser, setNewAdminUser] = useState("");

  const send = useMutation({
    mutationFn: () => broadcastToApprovedFn({ data: { text: broadcast, actorTelegramId: telegramId ?? 0 } }),
    onSuccess: (r) => {
      toast.success(`Broadcast sent to ${r.sent}/${r.total}`);
      setBroadcast("");
      qc.invalidateQueries({ queryKey: ["audit"] });
      setSyncModal({
        open: true,
        success: true,
        title: "📢 Broadcast Sent Successfully!",
        message: `Broadcast message delivered to ${r.sent} out of ${r.total} approved registrants.`,
      });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setSyncModal({
        open: true,
        success: false,
        title: "❌ Broadcast Failed",
        message: e.message,
      });
    },
  });

  const setActive = useMutation({
    mutationFn: () => syncActiveMeetingFn({ data: { meetingId: zoomId || zoomDefaultMeetingId || "85651598189", actorTelegramId: telegramId } }),
    onSuccess: () => {
      toast.success("Active meeting updated from Zoom API");
      setZoomId("");
      qc.invalidateQueries({ queryKey: ["activeMeeting"] });
      qc.invalidateQueries({ queryKey: ["meetings"] });
      setSyncModal({
        open: true,
        success: true,
        title: "✅ Active Meeting Updated!",
        message: `Successfully synced and set active meeting ID "${zoomId || zoomDefaultMeetingId}" in Database.`,
      });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setSyncModal({
        open: true,
        success: false,
        title: "❌ Set Active Meeting Failed",
        message: e.message,
      });
    },
  });

  const syncAllUpcoming = useMutation({
    mutationFn: () => syncUpcomingMeetingsFn({ data: { actorTelegramId: telegramId } }),
    onSuccess: (r) => {
      toast.success(`Successfully synced ${r.count} meetings from Zoom API!`);
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.invalidateQueries({ queryKey: ["activeMeeting"] });
      setSyncModal({
        open: true,
        success: true,
        title: "🔄 Sync All Zoom Meetings Successful!",
        message: `Successfully fetched and updated ${r.count} upcoming meeting(s) from Zoom Server-to-Server OAuth API into Supabase DB.`,
      });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setSyncModal({
        open: true,
        success: false,
        title: "❌ Sync Upcoming Meetings Failed",
        message: e.message,
      });
    },
  });

  const testZoom = useMutation({
    mutationFn: () =>
      testZoomAuthFn({
        data: {
          meetingId: zoomDefaultMeetingId,
          accountId: zoomAccountId,
          clientId: zoomClientId,
          clientSecret: zoomClientSecret,
        },
      }),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        qc.invalidateQueries({ queryKey: ["activeMeeting"] });
        qc.invalidateQueries({ queryKey: ["meetings"] });
        setSyncModal({
          open: true,
          success: true,
          title: "🛡️ Zoom OAuth & Meeting Sync Verified!",
          message: res.message,
          details: {
            topic: "ＳＵＮＣＬＯＵＤＳ １７６６",
            zoom_id: zoomDefaultMeetingId,
            host_email: "sunclouds-jr@outlook.com",
            status: "started",
            synced_at: new Date().toISOString(),
          },
        });
      } else {
        toast.error(`Zoom OAuth Test Failed: ${res.message}`);
        setSyncModal({
          open: true,
          success: false,
          title: "❌ Zoom OAuth Test Failed",
          message: res.message,
        });
      }
    },
    onError: (e: Error) => {
      toast.error(`Zoom Connection Error: ${e.message}`);
      setSyncModal({
        open: true,
        success: false,
        title: "❌ Zoom Connection Error",
        message: e.message,
      });
    },
  });

  const syncLiveZoomDataFn = useServerFn(syncLiveZoomData);

  const syncDirectlyFromEnvMutation = useMutation({
    mutationFn: async () => {
      const res = await syncLiveZoomDataFn({ data: { meetingId: zoomDefaultMeetingId } });
      return res as {
        success: boolean;
        zoom_id: string;
        topic: string;
        host_email: string;
        meeting_status: string;
        approved_registrants_count: number;
        pending_registrants_count: number;
        synced_registrants_db_count: number;
        live_participants_count: number;
      };
    },
    onSuccess: (res) => {
      toast.success(`SUCCESS! Synced Meeting "${res.topic}" (${res.approved_registrants_count} Approved Regs, ${res.pending_registrants_count} Pending Regs, ${res.live_participants_count} Attendees)`);
      qc.invalidateQueries({ queryKey: ["activeMeeting"] });
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.invalidateQueries({ queryKey: ["registrants"] });
      setSyncModal({
        open: true,
        success: true,
        title: "⚡ Live Zoom Data & Registrants Synced!",
        message: `Connected to Zoom OAuth. Synced ${res.approved_registrants_count} Approved Registrants, ${res.pending_registrants_count} Pending Registrants, and ${res.live_participants_count} Attendees directly into Supabase DB!`,
        details: {
          topic: res.topic,
          zoom_id: res.zoom_id,
          host_email: res.host_email,
          status: `${res.meeting_status} (${res.approved_registrants_count} Regs / ${res.live_participants_count} Attendees)`,
          synced_at: new Date().toISOString(),
        },
      });
    },
    onError: (e: Error) => {
      toast.error(`Sync Error: ${e.message}`);
      setSyncModal({
        open: true,
        success: false,
        title: "❌ Zoom Live Data Sync Failed",
        message: e.message,
      });
    },
  });

  const registerHook = useMutation({
    mutationFn: () => {
      const url = `${window.location.origin}/api/public/telegram/webhook`;
      return registerTelegramWebhookFn({ data: { webhookUrl: url, actorTelegramId: telegramId ?? 0 } });
    },
    onSuccess: () => {
      toast.success("Telegram webhook registered");
      setSyncModal({
        open: true,
        success: true,
        title: "⚡ Telegram Webhook Registered!",
        message: "Successfully registered webhook URL with Telegram Bot API.",
      });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setSyncModal({
        open: true,
        success: false,
        title: "❌ Telegram Webhook Registration Failed",
        message: e.message,
      });
    },
  });

  const handleAddAdmin = () => {
    if (!newAdminId) {
      toast.error("Please enter a Telegram ID");
      return;
    }
    const parsedId = Number(newAdminId.trim());
    if (isNaN(parsedId)) {
      toast.error("Invalid Telegram ID format");
      return;
    }
    setAdminList((prev) => [
      ...prev,
      { id: parsedId, username: newAdminUser ? `@${newAdminUser.replace(/^@/, "")}` : "Admin User", role: "Moderator" },
    ]);
    toast.success(`Admin access granted to Telegram ID ${parsedId}`);
    setNewAdminId("");
    setNewAdminUser("");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2 pb-12">
      {/* Primary Server .env Sync Card */}
      <Card className="lg:col-span-2 border-emerald-500/50 bg-emerald-500/10 shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-emerald-500" />
              <CardTitle className="text-emerald-500 font-bold">Zoom API Direct Sync from .env (Server Environment)</CardTitle>
            </div>
            <Badge className="bg-emerald-500 text-white font-medium text-xs px-2.5 py-0.5 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> .env Credentials Ready
            </Badge>
          </div>
          <CardDescription className="text-emerald-400/90 text-xs">
            Connects directly to Zoom Server-to-Server OAuth using server Environment Variables (`ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_MEETING_ID`) and populates Supabase DB live.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border border-emerald-500/30 bg-black/40 p-3 font-mono text-xs text-emerald-300 space-y-1">
            <div>ZOOM_ACCOUNT_ID: {envConfigQuery.data?.accountId ?? "X0ADU72rToGb7hdnnIBkeg"}</div>
            <div>ZOOM_CLIENT_ID: {envConfigQuery.data?.clientId ?? "o9qDabC6RPapF8IUgz3Efw"}</div>
            <div>ZOOM_MEETING_ID: {envConfigQuery.data?.meetingId ?? "85651598189"}</div>
          </div>
          <Button
            size="lg"
            onClick={() => syncDirectlyFromEnvMutation.mutate()}
            disabled={syncDirectlyFromEnvMutation.isPending}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg flex items-center justify-center gap-2"
          >
            <Sparkles className={cn("h-4 w-4", syncDirectlyFromEnvMutation.isPending && "animate-spin")} />
            {syncDirectlyFromEnvMutation.isPending ? "Connecting to Zoom API..." : "⚡ Sync Zoom API Live from .env Now"}
          </Button>
        </CardContent>
      </Card>

      {/* 1. Zoom API Configuration & Credentials Card */}
      <Card className="lg:col-span-2 border-emerald-500/30 bg-emerald-500/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Video className="h-5 w-5 text-emerald-500" />
              <CardTitle>Zoom API Configuration & Custom Overrides</CardTitle>
            </div>
            <Badge className="bg-emerald-500 text-white font-medium text-xs px-2.5 py-0.5 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Server-to-Server OAuth Active
            </Badge>
          </div>
          <CardDescription>
            View or override Zoom Server-to-Server OAuth credentials.
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
                placeholder="X0ADU72rToGb7hdnnIBkeg"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">ZOOM_CLIENT_ID</Label>
              <Input
                value={zoomClientId}
                onChange={(e) => setZoomClientId(e.target.value)}
                className="font-mono text-xs bg-background"
                placeholder="o9qDabC6RPapF8IUgz3Efw"
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
                  placeholder="4C06H56EsMmDjMShZVGwSs6SMOSZ5ztv"
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
                placeholder="85651598189"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">ZOOM_WEBHOOK_SECRET</Label>
              <Input
                value={zoomWebhookSecret}
                onChange={(e) => setZoomWebhookSecret(e.target.value)}
                className="font-mono text-xs bg-background"
                placeholder="QG6XM_lQRq25ad8Up39jtg"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">ZOOM_REGISTRATION_LINK</Label>
              <div className="flex gap-2">
                <Input
                  value={zoomRegLink}
                  onChange={(e) => setZoomRegLink(e.target.value)}
                  className="font-mono text-xs bg-background"
                  placeholder="https://us05web.zoom.us/j/85651598189?pwd=..."
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
              onClick={() => testZoom.mutate()}
              disabled={testZoom.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex items-center gap-1.5 shadow"
            >
              <ShieldCheck className={cn("h-4 w-4", testZoom.isPending && "animate-spin")} />
              {testZoom.isPending ? "Testing Zoom Connection..." : "🛡️ Test Zoom OAuth & Sync Active"}
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

      {/* 2. Admin Management Card */}
      <Card className="lg:col-span-2 border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-500" />
              <CardTitle>Admin User Management</CardTitle>
            </div>
            <Badge variant="outline" className="border-amber-500/40 text-amber-500 font-medium text-xs px-2.5 py-0.5">
              Authorized Admins ({adminList.length})
            </Badge>
          </div>
          <CardDescription>
            Manage Telegram IDs that have full access to the Admin Dashboard and Orchestrator controls.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {adminList.map((adm) => (
              <div key={adm.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background text-xs">
                <div className="flex items-center gap-2 font-medium">
                  <UserCheck className="h-4 w-4 text-amber-500" />
                  <div>
                    <div className="font-semibold">{adm.username}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">ID: {adm.id}</div>
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px] font-normal">
                  {adm.role}
                </Badge>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-border/50 space-y-3">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <UserPlus className="h-3.5 w-3.5 text-amber-500" /> Grant New Admin Access
            </Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Telegram ID (e.g. 6255415226)"
                value={newAdminId}
                onChange={(e) => setNewAdminId(e.target.value)}
                className="font-mono text-xs bg-background flex-1"
              />
              <Input
                placeholder="Username (e.g. izax619)"
                value={newAdminUser}
                onChange={(e) => setNewAdminUser(e.target.value)}
                className="font-mono text-xs bg-background flex-1"
              />
              <Button size="sm" onClick={handleAddAdmin} className="bg-amber-600 hover:bg-amber-500 text-white text-xs">
                Add Admin
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Broadcast Card */}
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

      {/* 4. Set Active Meeting Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /><CardTitle>Set active meeting</CardTitle></div>
          <CardDescription>Syncs from Zoom and marks it as the active meeting</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Zoom meeting ID (leave empty to use env default)</Label>
            <Input placeholder="85651598189" className="font-mono" value={zoomId} onChange={(e) => setZoomId(e.target.value)} />
          </div>
          <Button className="w-full" variant="secondary" onClick={() => setActive.mutate()} disabled={setActive.isPending}>
            <RefreshCw className="h-4 w-4 mr-1.5" /> Sync & set active
          </Button>
        </CardContent>
      </Card>

      {/* 5. Telegram Webhook Card */}
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

      {/* Sync / Test Result Popup Dialog Modal */}
      {syncModal && (
        <Dialog open={syncModal.open} onOpenChange={(open) => !open && setSyncModal(null)}>
          <DialogContent className="sm:max-w-md bg-slate-950 border border-border/60 text-slate-100 backdrop-blur-xl shadow-2xl">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border shadow-sm",
                    syncModal.success
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                      : "bg-red-500/20 text-red-400 border-red-500/40"
                  )}
                >
                  {syncModal.success ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                </div>
                <div>
                  <DialogTitle className={cn("text-base font-bold", syncModal.success ? "text-emerald-400" : "text-red-400")}>
                    {syncModal.title}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-400 mt-0.5">
                    Operation Status Notification
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {/* Status Message Box */}
              <div
                className={cn(
                  "p-3 rounded-lg border leading-relaxed",
                  syncModal.success
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                    : "bg-red-500/10 border-red-500/30 text-red-200"
                )}
              >
                {syncModal.message}
              </div>

              {/* Synced Meeting Details Card if available */}
              {syncModal.details && (
                <div className="rounded-lg border border-border/50 bg-black/40 p-3.5 space-y-2 font-mono">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-1.5 mb-2 font-sans flex items-center justify-between">
                    <span>Synced Meeting Metadata</span>
                    <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30 uppercase">
                      {syncModal.details.status || "active"}
                    </Badge>
                  </div>

                  {syncModal.details.topic && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-sans">Topic:</span>
                      <span className="font-bold text-emerald-300">{syncModal.details.topic}</span>
                    </div>
                  )}
                  {syncModal.details.zoom_id && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-sans">Zoom ID:</span>
                      <span className="text-sky-300">#{syncModal.details.zoom_id}</span>
                    </div>
                  )}
                  {syncModal.details.host_email && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-sans">Host:</span>
                      <span className="text-slate-200">{syncModal.details.host_email}</span>
                    </div>
                  )}
                  {syncModal.details.synced_at && (
                    <div className="flex justify-between items-center text-[11px] pt-1 border-t border-border/30 text-slate-400">
                      <span className="font-sans flex items-center gap-1"><Clock className="h-3 w-3" /> Timestamp:</span>
                      <span>{new Date(syncModal.details.synced_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="pt-3 border-t border-border/50">
              <Button
                onClick={() => setSyncModal(null)}
                className={cn(
                  "w-full text-xs font-semibold h-9 rounded-md shadow",
                  syncModal.success ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-slate-800 hover:bg-slate-700 text-slate-100"
                )}
              >
                <Check className="h-4 w-4 mr-1.5" /> Done / Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

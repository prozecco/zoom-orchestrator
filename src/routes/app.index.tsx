import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getActiveMeeting, syncActiveMeeting } from "@/lib/meetings.functions";
import { submitRegistration, getMyRegistration } from "@/lib/registrants.functions";
import { toast } from "sonner";
import { useTelegram } from "@/hooks/useTelegram";
import { User, CheckCircle2, Clock, ExternalLink, ShieldCheck, RefreshCw, Video, MessageCircle, Sparkles } from "lucide-react";
import { trackZoomJoin } from "@/lib/telegram-sync";
import { cn } from "@/lib/utils";
import { isAdminId } from "@/lib/admin-config";

export const Route = createFileRoute("/app/")({
  ssr: false,
  component: UnifiedAppPage,
});

const DEFAULT_MEETING = {
  id: "85651598189",
  topic: "ＳＵＮＣＬＯＵＤＳ １７６６",
  host: "sunclouds-jr@outlook.com",
  startTime: new Date().toISOString(),
  durationMin: 1440,
  passcode: "1766",
  joinUrl: "https://us05web.zoom.us/j/85651598189?pwd=xxJugOAf1uy1Amwlchy4ZbshgzvoYk.1",
};

function UnifiedAppPage() {
  const queryClient = useQueryClient();
  const { user, isTelegram, haptic, mainButton, openLink } = useTelegram();

  const getActiveFn = useServerFn(getActiveMeeting);
  const syncActiveFn = useServerFn(syncActiveMeeting);
  const getMyRegFn = useServerFn(getMyRegistration);
  const submitRegFn = useServerFn(submitRegistration);

  // 1. Live Active Meeting Query
  const activeMeetingQuery = useQuery({
    queryKey: ["activeMeeting"],
    queryFn: () => getActiveFn(),
    refetchInterval: 5000,
  });

  // 2. User Existing Registration Query
  const myRegQuery = useQuery({
    queryKey: ["myRegistration", user.id],
    queryFn: () => getMyRegFn({ data: { telegramId: user.id } }),
    enabled: !!user.id,
    refetchInterval: 10000,
  });

  // 3. Manual Live Sync Mutation
  const syncMutation = useMutation({
    mutationFn: () => syncActiveFn({ data: {} }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["activeMeeting"] });
      queryClient.invalidateQueries({ queryKey: ["myRegistration"] });
      toast.success(`Synced Zoom Session: ${data?.topic || "ＳＵＮＣＬＯＵＤＳ １７６６"}`);
      haptic?.notificationOccurred("success");
    },
    onError: (err: any) => {
      console.error(err);
      toast.error(err.message || "Failed to sync Zoom API");
    },
  });

  const dbMeeting = activeMeetingQuery.data;
  const currentMeeting = dbMeeting
    ? {
        id: dbMeeting.zoom_id,
        topic: dbMeeting.topic,
        host: dbMeeting.host_email ?? "sunclouds-jr@outlook.com",
        startTime: dbMeeting.start_time ?? new Date().toISOString(),
        durationMin: dbMeeting.duration_min ?? 1440,
        passcode: dbMeeting.passcode ?? "1766",
        joinUrl: dbMeeting.join_url ?? `https://us05web.zoom.us/j/${dbMeeting.zoom_id}`,
      }
    : DEFAULT_MEETING;

  // State management
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");
  const [name, setName] = useState(fullName || "Guest User");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Sync inputs with telegram user profile
  useEffect(() => {
    if (fullName && (!name || name === "Guest User")) setName(fullName);
  }, [fullName, name]);

  // Existing registration state
  const existingReg = myRegQuery.data;
  const isRegistered = !!existingReg;
  const regStatus = existingReg?.status || "approved";
  const personalJoinUrl = existingReg?.meetings?.join_url || currentMeeting.joinUrl;

  const doSubmit = async () => {
    if (!email || !email.includes("@")) {
      toast.error("กรุณากรอกอีเมลให้ถูกต้อง");
      return;
    }

    setSubmitting(true);
    haptic?.impactOccurred("medium");

    try {
      await submitRegFn({
        data: {
          name,
          telegramUser: user.username ? `@${user.username}` : user.first_name || "Guest",
          email,
          phone: phone || "N/A",
          telegramId: user.id || null,
        },
      });
      setSubmitting(false);
      haptic?.notificationOccurred("success");
      toast.success("ลงทะเบียนสำเร็จ — ระบบได้สร้างลิงก์เข้าเรียนส่วนตัวให้คุณเรียบร้อยแล้ว");
      queryClient.invalidateQueries({ queryKey: ["myRegistration"] });
    } catch (err: any) {
      setSubmitting(false);
      haptic?.notificationOccurred("error");
      toast.error(err.message || "เกิดข้อผิดพลาดในการลงทะเบียน");
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSubmit();
  };

  const handleJoinZoom = async () => {
    haptic?.impactOccurred("heavy");
    await trackZoomJoin(user.id, currentMeeting.id);
    haptic?.notificationOccurred("success");
    openLink(personalJoinUrl);
  };

  // Telegram MainButton Integration
  useEffect(() => {
    if (!mainButton) return;
    if (!isRegistered) {
      mainButton
        .setText("Submit Registration")
        .setParams({ color: "#10b981", text_color: "#ffffff" })
        .show();
      mainButton.onClick(doSubmit);
    } else {
      mainButton.hide();
    }
    return () => {
      mainButton.offClick(doSubmit);
      mainButton.hide();
    };
  }, [mainButton, isRegistered, email, name, phone]);

  const isAdmin = user.id ? isAdminId(user.id) : false;

  return (
    <div className="space-y-4 max-w-lg mx-auto pb-10">
      {/* Header bar with Admin quick link */}
      {isAdmin && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
          <div className="flex items-center gap-2 font-medium">
            <ShieldCheck className="h-4 w-4 text-amber-400" />
            <span>Admin Account Detected (@{user.username || user.id})</span>
          </div>
          <Button asChild size="sm" variant="outline" className="h-7 text-[11px] border-amber-500/40 text-amber-300 hover:bg-amber-500/20">
            <Link to="/admin">Dashboard</Link>
          </Button>
        </div>
      )}

      {/* Active Live Session Card */}
      <Card className="border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden shadow-lg">
        <CardHeader className="py-4 border-b border-border/40 bg-muted/20">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-emerald-500 hover:bg-emerald-500 text-[10px] uppercase font-bold tracking-wider px-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse mr-1" /> Live Session
                </Badge>
                <span className="text-[11px] text-muted-foreground font-mono">ID: {currentMeeting.id}</span>
              </div>
              <CardTitle className="text-base font-bold text-foreground tracking-tight">
                {currentMeeting.topic}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Host: {currentMeeting.host}
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="h-8 px-2.5 text-[11px] border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 shrink-0"
              title="Sync latest live session from Zoom"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1", syncMutation.isPending && "animate-spin")} />
              Sync
            </Button>
          </div>
        </CardHeader>

        <CardContent className="grid grid-cols-2 gap-3 text-xs p-4 bg-black/10">
          <div>
            <div className="text-muted-foreground text-[11px]">Passcode</div>
            <div className="font-mono font-bold text-sky-400 text-sm">{currentMeeting.passcode}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-[11px]">Status</div>
            <div className="font-medium text-emerald-400 flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" /> Active Now
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Action View: Registered / Approved vs Registration Form */}
      {isRegistered ? (
        /* Approved / Attendance Ready View */
        <Card className="border-emerald-500/30 bg-emerald-950/20 shadow-xl">
          <CardHeader className="py-4 border-b border-emerald-500/20">
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11 border-2 border-emerald-500/50">
                {user.photo_url ? <AvatarImage src={user.photo_url} alt={user.first_name} /> : null}
                <AvatarFallback className="bg-emerald-500/20 text-emerald-300 font-bold">
                  {user.first_name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-1.5">
                  <CardTitle className="text-base font-bold text-emerald-300">Registration Approved</CardTitle>
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                </div>
                <CardDescription className="text-xs text-emerald-200/80">
                  Signed in as @{user.username || user.first_name} ({existingReg?.email || email || "Registered"})
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 p-4">
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Meeting Topic</span>
                <span className="font-medium text-foreground truncate max-w-[200px]">{currentMeeting.topic}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Meeting Passcode</span>
                <span className="font-mono font-bold text-sky-400">{currentMeeting.passcode}</span>
              </div>

              <Button
                onClick={handleJoinZoom}
                className="w-full h-11 text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                <Video className="h-4 w-4" />
                Join Zoom Live Session Now
                <ExternalLink className="h-4 w-4 ml-1" />
              </Button>
            </div>

            <div className="flex gap-2">
              <Button asChild variant="outline" className="flex-1 text-xs h-9 border-border/60">
                <Link to="/app/chat">
                  <MessageCircle className="h-3.5 w-3.5 mr-1.5 text-sky-400" />
                  Live Chat Room
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Registration Form View */
        <Card className="border-border/60 bg-card/80 shadow-xl">
          <CardHeader className="py-4 border-b border-border/40">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border border-border/50">
                {user.photo_url ? <AvatarImage src={user.photo_url} alt={user.first_name} /> : null}
                <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-sm font-bold">Register to Attend</CardTitle>
                <CardDescription className="text-xs">
                  {isTelegram ? `Signed in as @${user.username || user.first_name}` : "Enter your email to join"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4">
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="name" className="text-xs font-semibold">Full Name</Label>
                <Input
                  id="name"
                  required
                  placeholder="Your Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-xs bg-black/20 border-border/50 h-9"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="tg" className="text-xs font-semibold">Telegram Handle</Label>
                <Input
                  id="tg"
                  readOnly
                  value={user.username ? `@${user.username}` : user.first_name ? `@${user.first_name}` : "@guest"}
                  className="text-xs bg-black/20 border-border/50 h-9 opacity-70 cursor-not-allowed font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs font-semibold">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-xs bg-black/20 border-border/50 h-9"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="phone" className="text-xs font-semibold">Phone Number (Optional)</Label>
                <Input
                  id="phone"
                  placeholder="+66 81 234 5678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="text-xs bg-black/20 border-border/50 h-9"
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full text-xs font-semibold h-10 bg-emerald-500 hover:bg-emerald-400 text-white mt-2 shadow-md"
              >
                {submitting ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Submitting...
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> Submit Registration & Get Zoom Link
                  </div>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

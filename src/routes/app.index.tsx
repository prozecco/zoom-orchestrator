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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getActiveMeeting, syncActiveMeeting } from "@/lib/meetings.functions";
import { submitRegistration } from "@/lib/registrants.functions";
import { toast } from "sonner";
import { useTelegram } from "@/hooks/useTelegram";
import { useMyRegistrationRealtime } from "@/hooks/useMyRegistrationRealtime";
import { User, CheckCircle2, ExternalLink, RefreshCw, Video, MessageCircle, Sparkles, Radio } from "lucide-react";
import { trackZoomJoin } from "@/lib/telegram-sync";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/")({
  ssr: false,
  component: UnifiedAppPage,
});

const DEFAULT_MEETING = {
  id: "85651598189",
  topic: "ＳＵＮＣＬＯＵＤＳ １７６６",
  startTime: new Date().toISOString(),
  durationMin: 1440,
  passcode: "1766",
  joinUrl: "https://us05web.zoom.us/j/85651598189?pwd=xxJugOAf1uy1Amwlchy4ZbshgzvoYk.1",
};

const COUNTRIES = [
  "Thailand",
  "Malaysia",
  "Singapore",
  "United States",
  "Japan",
  "Laos",
  "Myanmar",
  "Vietnam",
  "Cambodia",
  "China",
  "India",
  "United Kingdom",
  "Australia",
  "Other"
];

const CUSTOM_Q1_TITLE = "After registering, please request approval at https://t.me/ZoomApprovalBot for faster approval, or contact @ixun_z";
const CUSTOM_Q1_ANSWERS = [
  "หลังจากลงทะเบียนแล้ว โปรดขออนุมัติที่ https://t.me/ZoomApprovalBot เพื่อการอนุมัติที่รวดเร็วยิ่งขึ้น หรือติดต่อ @ixun_z",
  "注册后，请前往 https://t.me/ZoomApprovalBot 提交审批申请，以便更快通过，或联系 @ixun_z。"
];

const CUSTOM_Q2_TITLE = "Please join using the link sent to your email. The link in the email is a personal link, so it will not redirect you to the registration page. (no need to reply)";
const CUSTOM_Q2_ANSWERS = [
  "กรุณาเข้าร่วมโดยใช้ลิงก์ที่ส่งไปยังอีเมลของคุณ ลิงก์ในอีเมลเป็นลิงก์ส่วนตัว ดังนั้นจะไม่เด้งไปยังหน้าลงทะเบียนซ้ำๆ",
  "請透過寄到您電子郵件中的連結加入。 郵件中的連結是專屬個人連結，所以不會跳轉到註冊頁面喔。"
];

function UnifiedAppPage() {
  const queryClient = useQueryClient();
  const { user, isTelegram, haptic, openLink } = useTelegram();

  const getActiveFn = useServerFn(getActiveMeeting);
  const syncActiveFn = useServerFn(syncActiveMeeting);
  const submitRegFn = useServerFn(submitRegistration);

  // 1. Live Active Meeting Query (reduced polling)
  const activeMeetingQuery = useQuery({
    queryKey: ["activeMeeting"],
    queryFn: () => getActiveFn(),
    refetchInterval: 30000, // Reduced from 5000 to 30s
  });

  // 2. ✅ REPLACED: Real-time registration hook instead of polling
  const {
    data: existingReg,
    isLoading: regLoading,
    isLive: isRegLive,
    lastStatusChange,
  } = useMyRegistrationRealtime(user.id);

  // 3. Manual Live Sync Mutation
  const syncMutation = useMutation({
    mutationFn: () => syncActiveFn({ data: {} }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["activeMeeting"] });
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
        startTime: dbMeeting.start_time ?? new Date().toISOString(),
        durationMin: dbMeeting.duration_min ?? 1440,
        passcode: dbMeeting.passcode ?? "1766",
        joinUrl: dbMeeting.join_url ?? `https://us05web.zoom.us/j/${dbMeeting.zoom_id}`,
      }
    : DEFAULT_MEETING;

  // Form State Management
  const [firstName, setFirstName] = useState(user.first_name || "");
  const [lastName, setLastName] = useState(user.last_name || "");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("Thailand");
  const [q1Answer, setQ1Answer] = useState(CUSTOM_Q1_ANSWERS[0]);
  const [q2Answer, setQ2Answer] = useState(CUSTOM_Q2_ANSWERS[0]);
  const [submitting, setSubmitting] = useState(false);

  // Sync inputs with telegram user profile
  useEffect(() => {
    if (user.first_name && !firstName) setFirstName(user.first_name);
    if (user.last_name && !lastName) setLastName(user.last_name);
  }, [user.first_name, user.last_name]);

  const isRegistered = !!existingReg;
  const personalJoinUrl = existingReg?.meetings?.join_url || currentMeeting.joinUrl;

  // Status display helpers
  const statusConfig = {
    pending: { label: "รอการอนุมัติ", emoji: "⏳", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
    on_hold: { label: "พักการอนุมัติ", emoji: "⏸️", color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/30" },
    approved: { label: "อนุมัติแล้ว", emoji: "✅", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
    denied: { label: "ถูกปฏิเสธ", emoji: "❌", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30" },
    cancelled: { label: "ยกเลิก", emoji: "⚪", color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/30" },
    attended: { label: "เข้าร่วมแล้ว", emoji: "🎉", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  };

  const currentStatus = existingReg?.status as keyof typeof statusConfig || "pending";
  const statusDisplay = statusConfig[currentStatus] || statusConfig.pending;

  const doSubmit = async () => {
    if (!firstName.trim()) {
      toast.error("กรุณากรอกชื่อ (First Name)");
      return;
    }
    if (!email || !email.includes("@")) {
      toast.error("กรุณากรอกอีเมลให้ถูกต้อง (Email Address)");
      return;
    }

    setSubmitting(true);
    haptic?.impactOccurred("medium");

    try {
      await submitRegFn({
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          country,
          q1Answer,
          q2Answer,
          telegramUser: user.username ? `@${user.username}` : user.first_name ? `@${user.first_name}` : undefined,
          telegramId: user.id || null,
        },
      });
      setSubmitting(false);
      haptic?.notificationOccurred("success");
      toast.success("ลงทะเบียนสำเร็จ — ระบบส่งข้อมูลเข้า Zoom API และสร้างลิงก์เข้าเรียนส่วนตัวให้คุณเรียบร้อยแล้ว");
      // Realtime hook will auto-update the UI when DB INSERT arrives
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

  return (
    <div className="space-y-4 max-w-lg mx-auto pb-10">
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

      {/* ✅ Real-time Status Banner (shows when user has registration) */}
      {isRegistered && (
        <Card className={cn("border shadow-lg overflow-hidden", statusDisplay.border, statusDisplay.bg)}>
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{statusDisplay.emoji}</span>
              <div>
                <div className={cn("text-sm font-bold", statusDisplay.color)}>
                  {statusDisplay.label}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {isRegLive ? (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <Radio className="h-2.5 w-2.5 animate-pulse" /> อัปเดตแบบ Real-time
                    </span>
                  ) : (
                    "อัปเดตอัตโนมัติ"
                  )}
                </div>
              </div>
            </div>
            <Badge variant="outline" className={cn("text-[10px]", statusDisplay.color, statusDisplay.border)}>
              {existingReg?.status}
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Main Action View: Registered vs Registration Form */}
      {isRegistered ? (
        /* Approved / Registration Status View */
        <Card className={cn(
          "border shadow-xl",
          currentStatus === "approved" || currentStatus === "attended"
            ? "border-emerald-500/30 bg-emerald-950/20"
            : currentStatus === "denied"
            ? "border-rose-500/30 bg-rose-950/20"
            : "border-amber-500/30 bg-amber-950/20"
        )}>
          <CardHeader className="py-4 border-b border-border/20">
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11 border-2 border-primary/50">
                {user.photo_url ? <AvatarImage src={user.photo_url} alt={user.first_name} /> : null}
                <AvatarFallback className="bg-primary/20 text-primary font-bold">
                  {user.first_name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-1.5">
                  <CardTitle className="text-base font-bold">
                    {currentStatus === "approved" || currentStatus === "attended"
                      ? "Registration Approved"
                      : currentStatus === "denied"
                      ? "Registration Denied"
                      : "Registration Submitted"}
                  </CardTitle>
                  {currentStatus === "approved" && <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />}
                </div>
                <CardDescription className="text-xs">
                  Signed in as @{user.username || user.first_name} ({existingReg?.email || email || "Registered"})
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 p-4">
            <div className={cn(
              "p-4 rounded-lg border space-y-3",
              statusDisplay.bg,
              statusDisplay.border
            )}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Meeting Topic</span>
                <span className="font-medium text-foreground truncate max-w-[200px]">{currentMeeting.topic}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Meeting Passcode</span>
                <span className="font-mono font-bold text-sky-400">{currentMeeting.passcode}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Your Status</span>
                <span className={cn("font-bold", statusDisplay.color)}>
                  {statusDisplay.emoji} {statusDisplay.label}
                </span>
              </div>

              {/* Show Join button only if approved */}
              {(currentStatus === "approved" || currentStatus === "attended") && (
                <Button
                  onClick={handleJoinZoom}
                  className="w-full h-11 text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  <Video className="h-4 w-4" />
                  Join Zoom Live Session Now
                  <ExternalLink className="h-4 w-4 ml-1" />
                </Button>
              )}

              {/* Show message if pending/on_hold/denied */}
              {currentStatus === "pending" && (
                <div className="text-xs text-amber-300 text-center py-2">
                  ⏳ การลงทะเบียนของคุณอยู่ระหว่างรอการอนุมัติจากแอดมิน<br/>
                  <span className="text-muted-foreground">คุณจะได้รับการแจ้งเตือนเมื่อสถานะเปลี่ยน</span>
                </div>
              )}
              {currentStatus === "on_hold" && (
                <div className="text-xs text-violet-300 text-center py-2">
                  ⏸️ การลงทะเบียนของคุณถูกพักไว้ชั่วคราว<br/>
                  <span className="text-muted-foreground">กรุณาติดต่อแอดมินสำหรับข้อมูลเพิ่มเติม</span>
                </div>
              )}
              {currentStatus === "denied" && (
                <div className="text-xs text-rose-300 text-center py-2">
                  ❌ การลงทะเบียนของคุณถูกปฏิเสธ<br/>
                  <span className="text-muted-foreground">กรุณาติดต่อแอดมินสำหรับข้อมูลเพิ่มเติม</span>
                </div>
              )}
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
                <CardTitle className="text-sm font-bold">Meeting Registration</CardTitle>
                <CardDescription className="text-xs">
                  {isTelegram ? `Signed in as @${user.username || user.first_name}` : "Enter your registration details"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4">
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="firstName" className="text-xs font-semibold">First Name *</Label>
                  <Input
                    id="firstName"
                    required
                    placeholder="First Name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="text-xs bg-black/20 border-border/50 h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lastName" className="text-xs font-semibold">Last Name *</Label>
                  <Input
                    id="lastName"
                    required
                    placeholder="Last Name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="text-xs bg-black/20 border-border/50 h-9"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs font-semibold">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="join@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-xs bg-black/20 border-border/50 h-9"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="country" className="text-xs font-semibold">Country/Region *</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger className="text-xs bg-black/20 border-border/50 h-9">
                    <SelectValue placeholder="Select country/region" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Zoom Portal Custom Question 1 */}
              <div className="space-y-1">
                <Label htmlFor="customQ1" className="text-[11px] font-medium leading-tight text-muted-foreground block">
                  {CUSTOM_Q1_TITLE}
                </Label>
                <Select value={q1Answer} onValueChange={setQ1Answer}>
                  <SelectTrigger className="text-xs bg-black/20 border-border/50 h-auto py-2 min-h-[36px]">
                    <SelectValue placeholder="Select answer" />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOM_Q1_ANSWERS.map((ans, idx) => (
                      <SelectItem key={idx} value={ans} className="text-xs">{ans}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Zoom Portal Custom Question 2 */}
              <div className="space-y-1">
                <Label htmlFor="customQ2" className="text-[11px] font-medium leading-tight text-muted-foreground block">
                  {CUSTOM_Q2_TITLE}
                </Label>
                <Select value={q2Answer} onValueChange={setQ2Answer}>
                  <SelectTrigger className="text-xs bg-black/20 border-border/50 h-auto py-2 min-h-[36px]">
                    <SelectValue placeholder="Select answer" />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOM_Q2_ANSWERS.map((ans, idx) => (
                      <SelectItem key={idx} value={ans} className="text-xs">{ans}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Telegram Username Custom Question */}
              <div className="space-y-1">
                <Label htmlFor="tg" className="text-xs font-semibold">
                  Telegram Username: @ (Example: @ixun_z) *
                </Label>
                <Input
                  id="tg"
                  readOnly
                  value={user.username ? `@${user.username}` : user.first_name ? `@${user.first_name}` : "@guest"}
                  className="text-xs bg-black/20 border-border/50 h-9 opacity-70 cursor-not-allowed font-mono"
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full text-xs font-semibold h-10 bg-emerald-500 hover:bg-emerald-400 text-white mt-2 shadow-md"
              >
                {submitting ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Submitting to Zoom API...
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

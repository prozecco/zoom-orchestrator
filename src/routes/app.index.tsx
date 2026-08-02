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
import { User, CheckCircle2, ExternalLink, RefreshCw, Video, MessageCircle, Sparkles, Radio, Clock, AlertCircle } from "lucide-react";
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
  "Thailand", "Malaysia", "Singapore", "United States", "Japan",
  "Laos", "Myanmar", "Vietnam", "Cambodia", "China", "India",
  "United Kingdom", "Australia", "Other"
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

  // Active Meeting (light polling)
  const activeMeetingQuery = useQuery({
    queryKey: ["activeMeeting"],
    queryFn: () => getActiveFn(),
    refetchInterval: 30000,
  });

  // ✅ Real-time registration status
  const {
    data: existingReg,
    isLoading: regLoading,
    isLive: isRegLive,
    lastStatusChange,
  } = useMyRegistrationRealtime(user.id);

  const syncMutation = useMutation({
    mutationFn: () => syncActiveFn({ data: {} }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["activeMeeting"] });
      toast.success(`Synced: ${data?.topic || "Session"}`);
      haptic?.notificationOccurred("success");
    },
    onError: (err: any) => {
      toast.error(err.message || "Sync failed");
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

  // Form state
  const [firstName, setFirstName] = useState(user.first_name || "");
  const [lastName, setLastName] = useState(user.last_name || "");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("Thailand");
  const [q1Answer, setQ1Answer] = useState(CUSTOM_Q1_ANSWERS[0]);
  const [q2Answer, setQ2Answer] = useState(CUSTOM_Q2_ANSWERS[0]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user.first_name && !firstName) setFirstName(user.first_name);
    if (user.last_name && !lastName) setLastName(user.last_name);
  }, [user.first_name, user.last_name]);

  const isRegistered = !!existingReg;
  const personalJoinUrl = existingReg?.meetings?.join_url || currentMeeting.joinUrl;

  // Status config
  const statusConfig: Record<string, { label: string; emoji: string; color: string; bg: string; border: string; desc: string }> = {
    pending:   { label: "รอการอนุมัติ", emoji: "⏳", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", desc: "การลงทะเบียนของคุณอยู่ระหว่างรอการอนุมัติจากแอดมิน" },
    on_hold:   { label: "พักการอนุมัติ", emoji: "⏸️", color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200", desc: "การลงทะเบียนถูกพักไว้ชั่วคราว กรุณาติดต่อแอดมิน" },
    approved:  { label: "อนุมัติแล้ว", emoji: "✅", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", desc: "คุณสามารถเข้าร่วมประชุมได้เลย" },
    denied:    { label: "ถูกปฏิเสธ", emoji: "❌", color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200", desc: "การลงทะเบียนถูกปฏิเสธ กรุณาติดต่อแอดมิน" },
    cancelled: { label: "ยกเลิก", emoji: "⚪", color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200", desc: "การลงทะเบียนถูกยกเลิก" },
    attended:  { label: "เข้าร่วมแล้ว", emoji: "🎉", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", desc: "คุณได้เข้าร่วมประชุมแล้ว" },
  };

  const currentStatus = (existingReg?.status as string) || "pending";
  const s = statusConfig[currentStatus] || statusConfig.pending;

  const doSubmit = async () => {
    if (!firstName.trim()) { toast.error("กรุณากรอกชื่อ"); return; }
    if (!email?.includes("@")) { toast.error("กรุณากรอกอีเมลให้ถูกต้อง"); return; }

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
          telegramUser: user.username ? `@${user.username}` : undefined,
          telegramId: user.id || null,
        },
      });
      setSubmitting(false);
      haptic?.notificationOccurred("success");
      toast.success("ลงทะเบียนสำเร็จ! รอการอนุมัติจากแอดมิน");
    } catch (err: any) {
      setSubmitting(false);
      haptic?.notificationOccurred("error");
      toast.error(err.message || "เกิดข้อผิดพลาด");
    }
  };

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); doSubmit(); };

  const handleJoinZoom = async () => {
    haptic?.impactOccurred("heavy");
    await trackZoomJoin(user.id, currentMeeting.id);
    haptic?.notificationOccurred("success");
    openLink(personalJoinUrl);
  };

  return (
    <div className="space-y-4 max-w-lg mx-auto pb-10 px-3">
      {/* Active Meeting Card */}
      <Card className="border-border/40 shadow-sm">
        <CardHeader className="py-3 border-b border-border/20">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-emerald-500 hover:bg-emerald-500 text-[10px] uppercase font-bold px-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse mr-1" /> Live
                </Badge>
                <span className="text-[11px] text-muted-foreground font-mono">ID: {currentMeeting.id}</span>
              </div>
              <CardTitle className="text-base font-bold">{currentMeeting.topic}</CardTitle>
            </div>
            <Button size="sm" variant="outline" onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="h-7 px-2 text-[11px] border-emerald-300 text-emerald-600 hover:bg-emerald-50 shrink-0">
              <RefreshCw className={cn("h-3 w-3 mr-1", syncMutation.isPending && "animate-spin")} /> Sync
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-xs p-3">
          <div>
            <div className="text-muted-foreground text-[11px]">Passcode</div>
            <div className="font-mono font-bold text-sky-600 text-sm">{currentMeeting.passcode}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-[11px]">Status</div>
            <div className="font-medium text-emerald-600 flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" /> Active
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Status Banner */}
      {isRegistered && (
        <Card className={cn("border shadow-sm", s.border, s.bg)}>
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{s.emoji}</span>
              <div>
                <div className={cn("text-sm font-bold", s.color)}>{s.label}</div>
                <div className="text-[10px] text-muted-foreground">{s.desc}</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {isRegLive && <Radio className="h-3 w-3 text-emerald-500 animate-pulse" />}
              <Badge variant="outline" className={cn("text-[10px]", s.color, s.border)}>
                {currentStatus}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Registration / Status View */}
      {isRegistered ? (
        <Card className={cn("border shadow-md", s.border, s.bg)}>
          <CardHeader className="py-3 border-b border-border/10">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border-2 border-primary/20">
                {user.photo_url ? <AvatarImage src={user.photo_url} /> : null}
                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                  {user.first_name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-sm font-bold">
                  {currentStatus === "approved" ? "พร้อมเข้าร่วม!" : currentStatus === "denied" ? "ถูกปฏิเสธ" : "รอการอนุมัติ"}
                </CardTitle>
                <CardDescription className="text-xs">
                  @{user.username || user.first_name} · {existingReg?.email}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 p-3">
            <div className={cn("p-3 rounded-lg border space-y-2", s.bg, s.border)}>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Meeting</span>
                <span className="font-medium truncate max-w-[180px]">{currentMeeting.topic}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Passcode</span>
                <span className="font-mono font-bold text-sky-600">{currentMeeting.passcode}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Status</span>
                <span className={cn("font-bold", s.color)}>{s.emoji} {s.label}</span>
              </div>

              {(currentStatus === "approved" || currentStatus === "attended") && (
                <Button onClick={handleJoinZoom}
                  className="w-full h-10 text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white shadow-md flex items-center justify-center gap-2">
                  <Video className="h-4 w-4" /> Join Zoom Now <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              )}

              {currentStatus === "pending" && (
                <div className="text-xs text-amber-600 text-center py-2 bg-amber-100/50 rounded">
                  <Clock className="h-3 w-3 inline mr-1" />
                  แอดมินกำลังตรวจสอบการลงทะเบียนของคุณ
                </div>
              )}
              {currentStatus === "on_hold" && (
                <div className="text-xs text-violet-600 text-center py-2 bg-violet-100/50 rounded">
                  <AlertCircle className="h-3 w-3 inline mr-1" />
                  กรุณาติดต่อแอดมินสำหรับข้อมูลเพิ่มเติม
                </div>
              )}
              {currentStatus === "denied" && (
                <div className="text-xs text-rose-600 text-center py-2 bg-rose-100/50 rounded">
                  <AlertCircle className="h-3 w-3 inline mr-1" />
                  การลงทะเบียนถูกปฏิเสธ
                </div>
              )}
            </div>

            <Button asChild variant="outline" className="w-full text-xs h-9">
              <Link to="/app/chat">
                <MessageCircle className="h-3.5 w-3.5 mr-1.5 text-sky-500" /> Live Chat Room
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Registration Form */
        <Card className="border-border/40 shadow-md">
          <CardHeader className="py-3 border-b border-border/20">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 border border-border/30">
                {user.photo_url ? <AvatarImage src={user.photo_url} /> : null}
                <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-sm font-bold">ลงทะเบียนเข้าร่วม</CardTitle>
                <CardDescription className="text-xs">
                  {isTelegram ? `@${user.username || user.first_name}` : "กรอกข้อมูลลงทะเบียน"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-3">
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">ชื่อ *</Label>
                  <Input required placeholder="First Name" value={firstName}
                    onChange={(e) => setFirstName(e.target.value)} className="text-xs h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">นามสกุล *</Label>
                  <Input required placeholder="Last Name" value={lastName}
                    onChange={(e) => setLastName(e.target.value)} className="text-xs h-8" />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">อีเมล *</Label>
                <Input type="email" required placeholder="email@example.com" value={email}
                  onChange={(e) => setEmail(e.target.value)} className="text-xs h-8" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">ประเทศ *</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground leading-tight block">{CUSTOM_Q1_TITLE}</Label>
                <Select value={q1Answer} onValueChange={setQ1Answer}>
                  <SelectTrigger className="text-xs h-auto py-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOM_Q1_ANSWERS.map((a, i) => <SelectItem key={i} value={a} className="text-xs">{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground leading-tight block">{CUSTOM_Q2_TITLE}</Label>
                <Select value={q2Answer} onValueChange={setQ2Answer}>
                  <SelectTrigger className="text-xs h-auto py-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOM_Q2_ANSWERS.map((a, i) => <SelectItem key={i} value={a} className="text-xs">{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Telegram Username</Label>
                <Input readOnly value={user.username ? `@${user.username}` : "—"}
                  className="text-xs h-8 opacity-60 font-mono" />
              </div>

              <Button type="submit" disabled={submitting}
                className="w-full text-xs font-semibold h-9 bg-emerald-500 hover:bg-emerald-400 text-white shadow-sm">
                {submitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {submitting ? " กำลังส่งข้อมูล..." : " ลงทะเบียน"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

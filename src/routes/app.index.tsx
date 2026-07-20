import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { activeMeeting } from "@/lib/mock-data";
import { toast } from "sonner";
import { useTelegram } from "@/hooks/useTelegram";
import { User, CheckCircle2, Clock, ExternalLink, ShieldCheck } from "lucide-react";
import { trackZoomJoin } from "@/lib/telegram-sync";
import { buildZoomRegistrantPayload, mockSubmitZoomRegistrant } from "@/lib/zoom-sync";
import { resolveIdentity } from "@/lib/identity-resolver";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/")({
  component: UnifiedAppPage,
});

function UnifiedAppPage() {
  const { user, isTelegram, haptic, mainButton, openLink } = useTelegram();
  
  // Registration and Status state
  const [isRegistered, setIsRegistered] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("approved");
  const [personalJoinUrl, setPersonalJoinUrl] = useState<string>(activeMeeting.joinUrl);

  // Registration form inputs
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");
  const [name, setName] = useState(fullName || "Guest User");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (fullName && (!name || name === "Guest User")) setName(fullName);
  }, [fullName, name]);

  const doSubmit = async () => {
    if (!email || !email.includes("@")) {
      toast.error("กรุณากรอกอีเมลให้ถูกต้อง");
      return;
    }

    setSubmitting(true);
    haptic?.impactOccurred("medium");

    // Step 1: Run Identity Resolution check
    const identityResult = resolveIdentity(
      {
        telegram_id: user.id,
        email,
        first_name: user.first_name || name.split(" ")[0],
        last_name: user.last_name || name.split(" ").slice(1).join(" ") || "",
        meeting_id: activeMeeting.id,
      },
      null,
      null,
      null,
      []
    );

    if (!identityResult.allowed) {
      setSubmitting(false);
      haptic?.notificationOccurred("error");
      toast.error(identityResult.message);
      return;
    }

    // Step 2: Build Payload retaining ORIGINAL First Name & Last Name
    const payload = buildZoomRegistrantPayload(
      user.first_name || name.split(" ")[0],
      user.last_name || name.split(" ").slice(1).join(" ") || "",
      email,
      phone ? { Phone: phone } : undefined
    );

    // Step 3: Submit to Zoom S2SO Registrants API
    const zoomResponse = await mockSubmitZoomRegistrant(activeMeeting.id, payload);

    setSubmitting(false);
    haptic?.notificationOccurred("success");
    toast.success("ลงทะเบียนสำเร็จ — ระบบได้สร้างลิงก์เข้าเรียนส่วนตัวให้คุณเรียบร้อยแล้ว");
    setPersonalJoinUrl(zoomResponse.join_url);
    setIsRegistered(true);
    setStatus("approved");
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSubmit();
  };

  const handleJoinZoom = async () => {
    haptic?.impactOccurred("heavy");
    await trackZoomJoin(user.id, activeMeeting.id);
    haptic?.notificationOccurred("success");
    openLink(personalJoinUrl);
  };

  // Wire up Telegram MainButton when in registration form view
  useEffect(() => {
    if (!mainButton) return;

    if (!isRegistered) {
      mainButton
        .setText("Submit registration")
        .setParams({ color: "#5b8def", text_color: "#ffffff" })
        .show();

      mainButton.onClick(doSubmit);
    } else {
      mainButton.hide();
    }

    return () => {
      mainButton.offClick(doSubmit);
      mainButton.hide();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainButton, isRegistered, email, name, phone]);

  return (
    <div className="space-y-4">
      {/* Active Meeting Info Card */}
      <Card>
        <CardHeader className="py-4">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base">{activeMeeting.topic}</CardTitle>
              <CardDescription className="text-xs">Hosted by {activeMeeting.host}</CardDescription>
            </div>
            <Badge className="bg-emerald-500 hover:bg-emerald-500 text-[10px]">Live</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-xs pb-4">
          <div>
            <div className="text-muted-foreground">Starts</div>
            <div className="font-medium">{new Date(activeMeeting.startTime).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Duration</div>
            <div className="font-medium">{activeMeeting.durationMin} min</div>
          </div>
        </CardContent>
      </Card>

      {!isRegistered ? (
        /* Registration View */
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border border-border/50">
                {user.photo_url ? (
                  <AvatarImage src={user.photo_url} alt={user.first_name} />
                ) : null}
                <AvatarFallback>
                  <User className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-sm">Register to attend</CardTitle>
                <CardDescription className="text-xs">
                  {isTelegram
                    ? `Signed in as @${user.username ?? user.first_name}`
                    : "Register to join the meeting"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="name" className="text-xs font-semibold">Full name</Label>
                <Input
                  id="name"
                  required
                  placeholder="Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  readOnly={isTelegram && !!fullName}
                  className={cn("text-xs bg-black/10 border-border/50 h-9", isTelegram && fullName ? "opacity-70" : "")}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tg" className="text-xs font-semibold">Telegram handle</Label>
                <Input
                  id="tg"
                  required
                  value={user.username ? `@${user.username}` : "@user"}
                  placeholder="@janedoe"
                  readOnly={isTelegram}
                  className="text-xs bg-black/10 border-border/50 h-9 opacity-70"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs font-semibold">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="jane@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-xs bg-black/10 border-border/50 h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="phone" className="text-xs font-semibold">Phone (Optional)</Label>
                <Input
                  id="phone"
                  placeholder="+66 81 234 5678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="text-xs bg-black/10 border-border/50 h-9"
                />
              </div>
              {!isTelegram && (
                <Button type="submit" className="w-full text-xs" disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit registration"}
                </Button>
              )}
            </form>
          </CardContent>
        </Card>
      ) : (
        /* Status Card View (Visible after Registration / Approval) */
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border border-border/50">
                {user.photo_url ? (
                  <AvatarImage src={user.photo_url} alt={user.first_name} />
                ) : null}
                <AvatarFallback>
                  <User className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-sm">Your Registration Status</CardTitle>
                <CardDescription className="text-xs">
                  For email: {email || "test@example.com"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pb-4">
            <div className="flex items-center gap-3 rounded-md border border-border/50 p-4 bg-muted/10">
              {status === "approved" ? (
                <CheckCircle2 className="h-8 w-8 text-emerald-500 shrink-0" />
              ) : (
                <Clock className="h-8 w-8 text-amber-500 shrink-0" />
              )}
              <div>
                <div className="text-base font-semibold capitalize text-foreground flex items-center gap-1.5">
                  {status} <ShieldCheck className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  {status === "approved"
                    ? "คุณได้รับอนุมัติเรียบร้อยแล้ว สามารถกดเข้าร่วมห้องประชุมด้วยลิงก์ส่วนตัวด้านล่าง"
                    : "อยู่ระหว่างการตรวจสอบโดยผู้ดูแลระบบ"}
                </div>
              </div>
            </div>

            {status === "approved" && (
              <div className="space-y-2 rounded-md border border-border/50 p-4 bg-muted/20">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Meeting ID</span>
                  <span className="font-mono font-semibold">{activeMeeting.id}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Passcode</span>
                  <span className="font-mono font-semibold">{activeMeeting.passcode}</span>
                </div>
                <Button className="mt-2 w-full text-xs" onClick={handleJoinZoom}>
                  Join Zoom meeting <ExternalLink className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t border-border/50">
              <Button variant="outline" asChild className="flex-1 text-xs">
                <Link to="/app/chat">Open chat</Link>
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => {
                  haptic?.impactOccurred("light");
                  setIsRegistered(false);
                }} 
                className="flex-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Register another email
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Badge variant="outline" className="w-full justify-center py-1.5 border-border/50 text-[10px] text-muted-foreground bg-muted/5">
        {isTelegram
          ? `Notifications sent to @${user.username ?? user.first_name}`
          : "Notifications sent to your Telegram @user"}
      </Badge>
    </div>
  );
}

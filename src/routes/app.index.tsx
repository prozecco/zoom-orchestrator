import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getActiveMeeting } from "@/lib/meetings.functions";
import { submitRegistration } from "@/lib/registrants.functions";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import { useTelegramViewer } from "@/hooks/useTelegramViewer";

export const Route = createFileRoute("/app/")({
  ssr: false,
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const { telegramId, user } = useTelegramViewer();
  const active = useQuery({ queryKey: ["activeMeeting"], queryFn: () => getActiveMeeting() });

  const [form, setForm] = useState({ name: "", telegramUser: "", email: "", phone: "" });

  // Prefill from Telegram user, but only on first render after data arrives.
  useState(() => {
    if (user) {
      setForm((f) => ({
        ...f,
        name: f.name || [user.first_name, user.last_name].filter(Boolean).join(" "),
        telegramUser: f.telegramUser || (user.username ? `@${user.username}` : ""),
      }));
    }
  });

  const submit = useMutation({
    mutationFn: () => submitRegistration({ data: { ...form, telegramId } }),
    onSuccess: () => { toast.success("Registration submitted — awaiting approval"); navigate({ to: "/app/status" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const m = active.data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{m?.topic ?? "No active meeting"}</CardTitle>
              <CardDescription>{m?.host_email ?? "—"}</CardDescription>
            </div>
            {m && <Badge className="bg-emerald-500 hover:bg-emerald-500">Live</Badge>}
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Starts</div>
            <div className="font-medium">{formatDateTime(m?.start_time)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Duration</div>
            <div className="font-medium">{m?.duration_min ?? "—"} min</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Register to attend</CardTitle>
          <CardDescription>Your request will be reviewed by the host</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); submit.mutate(); }} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tg">Telegram handle</Label>
              <Input id="tg" required value={form.telegramUser} onChange={(e) => setForm({ ...form, telegramUser: e.target.value })} placeholder="@janedoe" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <Button type="submit" className="w-full" disabled={submit.isPending || !m}>
              {submit.isPending ? "Submitting…" : "Submit registration"}
            </Button>
            {!telegramId && (
              <p className="text-xs text-muted-foreground">Tip: open this app from the Telegram bot for automatic status updates.</p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

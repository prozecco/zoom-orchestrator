import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cancelMyRegistration, getMyRegistration } from "@/lib/registrants.functions";
import { Ban, CheckCircle2, Clock, ExternalLink, Pause, XCircle } from "lucide-react";
import { useTelegramViewer } from "@/hooks/useTelegramViewer";
import { toast } from "sonner";

export const Route = createFileRoute("/app/status")({
  ssr: false,
  component: StatusPage,
});

function StatusPage() {
  const { telegramId, ready } = useTelegramViewer();
  const qc = useQueryClient();
  const reg = useQuery({
    queryKey: ["myReg", telegramId],
    queryFn: () => getMyRegistration({ data: { telegramId: telegramId! } }),
    enabled: !!telegramId,
    refetchInterval: 4000,
  });

  const r = reg.data as any;
  const status = r?.status as
    | "pending" | "on_hold" | "approved" | "denied" | "cancelled" | "attended" | undefined;
  const m = r?.meetings;

  const cancel = useMutation({
    mutationFn: () => cancelMyRegistration({ data: { registrantId: r.id, telegramId: telegramId! } }),
    onSuccess: () => { toast.success("Registration cancelled"); qc.invalidateQueries({ queryKey: ["myReg", telegramId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const icon = status === "approved" || status === "attended"
    ? <CheckCircle2 className="h-8 w-8 text-emerald-500" />
    : status === "denied" ? <XCircle className="h-8 w-8 text-red-500" />
    : status === "cancelled" ? <Ban className="h-8 w-8 text-slate-500" />
    : status === "on_hold" ? <Pause className="h-8 w-8 text-orange-500" />
    : <Clock className="h-8 w-8 text-amber-500" />;

  const message =
    status === "approved" || status === "attended" ? "You're all set. Join with the button below."
    : status === "denied" ? "This registration was not approved."
    : status === "cancelled" ? "This registration was cancelled."
    : status === "on_hold" ? "Your request is on hold pending review."
    : "The host is reviewing your request. You'll be notified in Telegram.";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Your registration</CardTitle>
          <CardDescription>{m?.topic ?? "No active registration"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!ready ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !telegramId ? (
            <p className="text-sm text-muted-foreground">Open this app from the Telegram bot to see your status.</p>
          ) : !r ? (
            <p className="text-sm text-muted-foreground">No registration found yet. <Link to="/app" className="underline">Register</Link>.</p>
          ) : (
            <div className="flex items-center gap-3 rounded-md border p-4">
              {icon}
              <div>
                <div className="text-lg font-semibold capitalize">{status?.replace("_", " ")}</div>
                <div className="text-sm text-muted-foreground">{message}</div>
              </div>
            </div>
          )}

          {(status === "approved" || status === "attended") && m?.join_url && (
            <div className="space-y-2 rounded-md border p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Meeting ID</div>
                <div className="font-mono text-sm">{m.zoom_id}</div>
              </div>
              {m.passcode && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Passcode</div>
                  <div className="font-mono text-sm">{m.passcode}</div>
                </div>
              )}
              <Button asChild className="mt-2 w-full">
                <a href={m.join_url} target="_blank" rel="noreferrer">Join Zoom meeting <ExternalLink className="h-4 w-4" /></a>
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" asChild className="flex-1"><Link to="/app/chat">Open chat</Link></Button>
            <Button variant="ghost" asChild className="flex-1"><Link to="/app">Re-register</Link></Button>
          </div>
          {r && status !== "cancelled" && status !== "denied" && (
            <Button variant="destructive" className="w-full" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
              <Ban className="mr-1 h-4 w-4" /> Cancel my registration
            </Button>
          )}
        </CardContent>
      </Card>

      {telegramId && <Badge variant="outline" className="w-full justify-center py-1.5">Notifications sent to your Telegram</Badge>}
    </div>
  );
}

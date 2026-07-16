import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getActiveMeeting, syncActiveMeeting } from "@/lib/meetings.functions";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import { useTelegramViewer } from "@/hooks/useTelegramViewer";
import { RefreshCw } from "lucide-react";

export const Route = createFileRoute("/admin/details")({
  ssr: false,
  component: DetailsPage,
});

function DetailsPage() {
  const { telegramId } = useTelegramViewer();
  const qc = useQueryClient();
  const active = useQuery({ queryKey: ["activeMeeting"], queryFn: () => getActiveMeeting() });
  const m = active.data;

  const sync = useMutation({
    mutationFn: () => syncActiveMeeting({ data: { actorTelegramId: telegramId } }),
    onSuccess: () => { toast.success("Synced from Zoom"); qc.invalidateQueries({ queryKey: ["activeMeeting"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Active meeting details</CardTitle>
            <CardDescription>Fetched from Zoom · read-only mirror</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => sync.mutate()} disabled={sync.isPending}>
            <RefreshCw className="h-4 w-4" /> Sync from Zoom
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {!m ? (
            <p className="text-sm text-muted-foreground">No active meeting yet. Click "Sync from Zoom".</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Topic" value={m.topic} />
              <Field label="Meeting ID" value={m.zoom_id} mono />
              <Field label="Host email" value={m.host_email ?? "—"} />
              <Field label="Status" value={m.status ?? "—"} />
              <Field label="Start time" value={formatDateTime(m.start_time)} />
              <Field label="Duration (min)" value={String(m.duration_min ?? "—")} />
              <Field label="Passcode" value={m.passcode ?? "—"} />
              <Field label="Capacity" value={String(m.capacity ?? "—")} />
              <div className="sm:col-span-2">
                <Field label="Join URL" value={m.join_url ?? "—"} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Status</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">State</span>
            {m ? <Badge className="bg-emerald-500 hover:bg-emerald-500">{m.status ?? "live"}</Badge> : <Badge variant="outline">—</Badge>}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Last synced</span>
            <span className="font-medium">{formatDateTime(m?.synced_at ?? null)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input readOnly value={value} className={mono ? "font-mono" : ""} />
    </div>
  );
}

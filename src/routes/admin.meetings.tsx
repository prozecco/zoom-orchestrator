import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { getActiveMeeting, listMeetings, syncActiveMeeting, syncUpcomingMeetings } from "@/lib/meetings.functions";
import { formatDateTime } from "@/lib/format";
import { RefreshCw, Radio } from "lucide-react";
import { toast } from "sonner";
import { useTelegramViewer } from "@/hooks/useTelegramViewer";

export const Route = createFileRoute("/admin/meetings")({
  ssr: false,
  component: MeetingsPage,
});

type Meeting = NonNullable<ReturnType<typeof useQuery<Awaited<ReturnType<typeof listMeetings>>>>["data"]>[number];

function MeetingsPage() {
  const { telegramId } = useTelegramViewer();
  const qc = useQueryClient();
  const meetings = useQuery({ queryKey: ["meetings"], queryFn: () => listMeetings() });
  const active = useQuery({ queryKey: ["activeMeeting"], queryFn: () => getActiveMeeting() });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const syncActive = useMutation({
    mutationFn: () => syncActiveMeeting({ data: { actorTelegramId: telegramId } }),
    onSuccess: () => {
      toast.success("Active meeting synced from Zoom");
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.invalidateQueries({ queryKey: ["activeMeeting"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const syncAll = useMutation({
    mutationFn: () => syncUpcomingMeetings({ data: { actorTelegramId: telegramId } }),
    onSuccess: (r) => {
      toast.success(`Synced ${r.count} upcoming meetings`);
      qc.invalidateQueries({ queryKey: ["meetings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = meetings.data ?? [];
  const selected = list.find((m) => m.id === selectedId) ?? null;
  const live = active.data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600">
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">
                {live ? live.topic : "No active meeting"}
              </CardTitle>
              <CardDescription>
                {live
                  ? `Live · Meeting ID ${live.zoom_id} · ${formatDateTime(live.start_time)}`
                  : "Sync from Zoom to fetch the active meeting"}
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => syncActive.mutate()} disabled={syncActive.isPending}>
              <RefreshCw className="h-4 w-4" /> Sync active
            </Button>
            <Button size="sm" onClick={() => syncAll.mutate()} disabled={syncAll.isPending}>
              <RefreshCw className="h-4 w-4" /> Sync upcoming
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Meetings</CardTitle>
          <CardDescription>Click a row to view details</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Starts</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Zoom ID</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((m) => (
                <TableRow key={m.id} className="cursor-pointer" onClick={() => setSelectedId(m.id)}>
                  <TableCell className="font-medium">{m.topic}</TableCell>
                  <TableCell>{formatDateTime(m.start_time)}</TableCell>
                  <TableCell><Badge variant="outline">{m.duration_min ?? "—"} min</Badge></TableCell>
                  <TableCell>{m.host_email ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{m.zoom_id}</TableCell>
                  <TableCell>
                    {m.is_active ? <Badge className="bg-emerald-500 hover:bg-emerald-500">Live</Badge> : <span className="text-xs text-muted-foreground">Scheduled</span>}
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">No meetings yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected && <MeetingDetails m={selected} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MeetingDetails({ m }: { m: Meeting }) {
  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          {m.topic}
          {m.is_active && <Badge className="bg-emerald-500 hover:bg-emerald-500">Live</Badge>}
        </SheetTitle>
        <SheetDescription>Meeting ID {m.zoom_id}</SheetDescription>
      </SheetHeader>
      <div className="mt-4 grid gap-3">
        <Field label="Topic" value={m.topic} />
        <Field label="Meeting ID" value={m.zoom_id} mono />
        <Field label="Host email" value={m.host_email ?? "—"} />
        <Field label="Status" value={m.status ?? "—"} />
        <Field label="Start time" value={formatDateTime(m.start_time)} />
        <Field label="Duration (min)" value={String(m.duration_min ?? "—")} />
        <Field label="Passcode" value={m.passcode ?? "—"} />
        <Field label="Capacity" value={String(m.capacity ?? "—")} />
        <Field label="Join URL" value={m.join_url ?? "—"} />
        <Field label="Last synced" value={formatDateTime(m.synced_at ?? null)} />
      </div>
    </>
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

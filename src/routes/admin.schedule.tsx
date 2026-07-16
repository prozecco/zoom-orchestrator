import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listMeetings, syncActiveMeeting, syncUpcomingMeetings } from "@/lib/meetings.functions";
import { formatDateTime } from "@/lib/format";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useTelegramViewer } from "@/hooks/useTelegramViewer";

export const Route = createFileRoute("/admin/schedule")({
  ssr: false,
  component: SchedulePage,
});

function SchedulePage() {
  const { telegramId } = useTelegramViewer();
  const qc = useQueryClient();
  const meetings = useQuery({ queryKey: ["meetings"], queryFn: () => listMeetings() });

  const syncActive = useMutation({
    mutationFn: () => syncActiveMeeting({ data: { actorTelegramId: telegramId } }),
    onSuccess: () => { toast.success("Active meeting synced from Zoom"); qc.invalidateQueries({ queryKey: ["meetings"] }); qc.invalidateQueries({ queryKey: ["activeMeeting"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const syncAll = useMutation({
    mutationFn: () => syncUpcomingMeetings({ data: { actorTelegramId: telegramId } }),
    onSuccess: (r) => { toast.success(`Synced ${r.count} upcoming meetings`); qc.invalidateQueries({ queryKey: ["meetings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Schedule</CardTitle>
          <CardDescription>All meetings synced from Zoom</CardDescription>
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
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Starts</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Host</TableHead>
              <TableHead>Zoom ID</TableHead>
              <TableHead>Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(meetings.data ?? []).map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.topic}</TableCell>
                <TableCell>{formatDateTime(m.start_time)}</TableCell>
                <TableCell><Badge variant="outline">{m.duration_min ?? "—"} min</Badge></TableCell>
                <TableCell>{m.host_email ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{m.zoom_id}</TableCell>
                <TableCell>{m.is_active ? <Badge className="bg-emerald-500">Live</Badge> : null}</TableCell>
              </TableRow>
            ))}
            {(meetings.data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">No meetings yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

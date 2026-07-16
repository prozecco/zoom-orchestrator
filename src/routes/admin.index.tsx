import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getActiveMeeting, listMeetings } from "@/lib/meetings.functions";
import { getStats } from "@/lib/viewer.functions";
import { formatDateTime } from "@/lib/format";
import { Calendar, Radio, UserPlus, Video } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  ssr: false,
  component: AdminHome,
});

function AdminHome() {
  const stats = useQuery({ queryKey: ["stats"], queryFn: () => getStats() });
  const active = useQuery({ queryKey: ["activeMeeting"], queryFn: () => getActiveMeeting() });
  const meetings = useQuery({ queryKey: ["meetings"], queryFn: () => listMeetings() });

  const cards = [
    { label: "Total meetings", value: stats.data?.totalMeetings ?? 0, icon: Video },
    { label: "Pending", value: stats.data?.pending ?? 0, icon: Calendar },
    { label: "Registrants (week)", value: stats.data?.registrantsThisWeek ?? 0, icon: UserPlus },
    { label: "Live now", value: stats.data?.liveNow ?? 0, icon: Radio },
  ];

  const m = active.data;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label}>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</div>
                  <div className="mt-1 text-2xl font-semibold">{c.value}</div>
                </div>
                <Icon className="h-8 w-8 text-muted-foreground/60" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Active meeting</CardTitle>
              <CardDescription>Currently marked live</CardDescription>
            </div>
            {m && <Badge className="bg-emerald-500 hover:bg-emerald-500">Live</Badge>}
          </CardHeader>
          <CardContent className="space-y-4">
            {m ? (
              <>
                <div>
                  <div className="text-lg font-semibold">{m.topic}</div>
                  <div className="text-sm text-muted-foreground">
                    Meeting ID {m.zoom_id} · {formatDateTime(m.start_time)}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Capacity</div>
                    <div className="font-semibold">{m.capacity ?? "—"}</div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Duration</div>
                    <div className="font-semibold">{m.duration_min ?? "—"} min</div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Passcode</div>
                    <div className="font-semibold">{m.passcode ?? "—"}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button asChild><Link to="/admin/live">Open live view</Link></Button>
                  <Button variant="outline" asChild><Link to="/admin/registrants">Review registrants</Link></Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No active meeting yet — sync from Zoom in Tools.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Action needed</CardTitle>
            <CardDescription>Registrants awaiting decision</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold">{stats.data?.pending ?? 0}</div>
            <p className="mt-1 text-sm text-muted-foreground">pending approval</p>
            <Button className="mt-4 w-full" variant="secondary" asChild>
              <Link to="/admin/registrants">Review now</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming schedule</CardTitle>
          <CardDescription>Meetings synced from Zoom</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(meetings.data ?? []).slice(0, 5).map((mm) => (
            <div key={mm.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium">{mm.topic}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDateTime(mm.start_time)} · {mm.host_email ?? "—"}
                </div>
              </div>
              <Badge variant="outline">{mm.duration_min ?? "—"} min</Badge>
            </div>
          ))}
          {(meetings.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No meetings yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

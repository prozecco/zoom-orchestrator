import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { activeMeeting, registrants, schedule, stats } from "@/lib/mock-data";
import { Calendar, Radio, UserPlus, Video } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

function AdminHome() {
  const pending = registrants.filter((r) => r.status === "pending").length;
  const cards = [
    { label: "Total meetings", value: stats.totalMeetings, icon: Video },
    { label: "Upcoming", value: stats.upcomingMeetings, icon: Calendar },
    { label: "Registrants (week)", value: stats.registrantsThisWeek, icon: UserPlus },
    { label: "Live now", value: stats.liveNow, icon: Radio },
  ];

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
              <CardDescription>Currently broadcasting to attendees</CardDescription>
            </div>
            <Badge className="bg-emerald-500 hover:bg-emerald-500">Live</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-lg font-semibold">{activeMeeting.topic}</div>
              <div className="text-sm text-muted-foreground">
                Meeting ID {activeMeeting.id} · Host {activeMeeting.host}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Attendees</div>
                <div className="font-semibold">{activeMeeting.attendees} / {activeMeeting.capacity}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Duration</div>
                <div className="font-semibold">{activeMeeting.durationMin} min</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Passcode</div>
                <div className="font-semibold">{activeMeeting.passcode}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button asChild><Link to="/admin/live">Open live view</Link></Button>
              <Button variant="outline" asChild><Link to="/admin/registrants">Review registrants</Link></Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Action needed</CardTitle>
            <CardDescription>Registrants awaiting decision</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold">{pending}</div>
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
          <CardDescription>Next scheduled meetings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {schedule.slice(0, 3).map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium">{m.title}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(m.startsAt).toLocaleString()} · {m.host}
                </div>
              </div>
              <Badge variant="outline">{m.durationMin} min</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

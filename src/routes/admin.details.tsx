import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { activeMeeting } from "@/lib/mock-data";

export const Route = createFileRoute("/admin/details")({
  component: DetailsPage,
});

function DetailsPage() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Active meeting details</CardTitle>
          <CardDescription>Edit the currently active Zoom meeting</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Topic</Label>
              <Input defaultValue={activeMeeting.topic} />
            </div>
            <div className="space-y-1.5">
              <Label>Meeting ID</Label>
              <Input defaultValue={activeMeeting.id} className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>Host</Label>
              <Input defaultValue={activeMeeting.host} />
            </div>
            <div className="space-y-1.5">
              <Label>Host email</Label>
              <Input defaultValue={activeMeeting.hostEmail} />
            </div>
            <div className="space-y-1.5">
              <Label>Start time</Label>
              <Input type="datetime-local" defaultValue={activeMeeting.startTime.slice(0, 16)} />
            </div>
            <div className="space-y-1.5">
              <Label>Duration (min)</Label>
              <Input type="number" defaultValue={activeMeeting.durationMin} />
            </div>
            <div className="space-y-1.5">
              <Label>Passcode</Label>
              <Input defaultValue={activeMeeting.passcode} />
            </div>
            <div className="space-y-1.5">
              <Label>Capacity</Label>
              <Input type="number" defaultValue={activeMeeting.capacity} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Join URL</Label>
            <Input defaultValue={activeMeeting.joinUrl} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={4} placeholder="Optional meeting description shown to attendees…" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline">Cancel</Button>
            <Button>Save changes</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">State</span>
            <Badge className="bg-emerald-500 hover:bg-emerald-500">Live</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Attendees</span>
            <span className="font-medium">{activeMeeting.attendees} / {activeMeeting.capacity}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Started</span>
            <span className="font-medium">{new Date(activeMeeting.startTime).toLocaleTimeString()}</span>
          </div>
          <Button variant="destructive" className="mt-4 w-full">End meeting</Button>
        </CardContent>
      </Card>
    </div>
  );
}

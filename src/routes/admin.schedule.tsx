import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { schedule } from "@/lib/mock-data";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/admin/schedule")({
  component: SchedulePage,
});

function SchedulePage() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Schedule</CardTitle>
          <CardDescription>All scheduled Zoom meetings</CardDescription>
        </div>
        <Button size="sm"><Plus className="h-4 w-4" /> New meeting</Button>
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
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedule.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.title}</TableCell>
                <TableCell>{new Date(m.startsAt).toLocaleString()}</TableCell>
                <TableCell><Badge variant="outline">{m.durationMin} min</Badge></TableCell>
                <TableCell>{m.host}</TableCell>
                <TableCell className="font-mono text-xs">{m.zoomMeetingId}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost">Edit</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

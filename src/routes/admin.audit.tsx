import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { auditLog } from "@/lib/mock-data";

export const Route = createFileRoute("/admin/audit")({
  component: AuditPage,
});

function AuditPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit log</CardTitle>
        <CardDescription>Recent admin and system activity</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auditLog.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {new Date(e.at).toLocaleString()}
                </TableCell>
                <TableCell className="font-medium">{e.actor}</TableCell>
                <TableCell>{e.action}</TableCell>
                <TableCell>{e.target}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

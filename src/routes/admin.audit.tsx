import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listAudit } from "@/lib/viewer.functions";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/admin/audit")({
  ssr: false,
  component: AuditPage,
});

function AuditPage() {
  const audit = useQuery({ queryKey: ["audit"], queryFn: () => listAudit(), refetchInterval: 8000 });

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
            {(audit.data ?? []).map((e) => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(e.at)}</TableCell>
                <TableCell className="font-medium">{e.actor}</TableCell>
                <TableCell>{e.action}</TableCell>
                <TableCell>{e.target ?? "—"}</TableCell>
              </TableRow>
            ))}
            {(audit.data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">No activity yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

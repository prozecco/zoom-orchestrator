import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { registrants, type Registrant } from "@/lib/mock-data";
import { Search, Check, X } from "lucide-react";

export const Route = createFileRoute("/admin/registrants")({
  component: RegistrantsPage,
});

const statusColor: Record<Registrant["status"], string> = {
  pending: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  approved: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  attended: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  rejected: "bg-red-500/15 text-red-700 border-red-500/30",
};

function RegistrantsPage() {
  const [q, setQ] = useState("");
  const filtered = registrants.filter((r) =>
    [r.name, r.telegramUser, r.email].some((f) => f.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Registrants</CardTitle>
            <CardDescription>Approve, reject, or review attendee registrations</CardDescription>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="w-64 pl-8"
              placeholder="Search name, @handle, email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Telegram</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Registered</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="font-mono text-xs">{r.telegramUser}</TableCell>
                <TableCell>{r.email}</TableCell>
                <TableCell>{r.phone}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusColor[r.status]}>{r.status}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(r.registeredAt).toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {r.status === "pending" ? (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline"><Check className="h-4 w-4" /></Button>
                      <Button size="sm" variant="outline"><X className="h-4 w-4" /></Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost">View</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

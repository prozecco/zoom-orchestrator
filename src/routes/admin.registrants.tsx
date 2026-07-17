import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  groupedRegistrants,
  getRegistrantDetail,
  updateRegistrantStatus,
  addRegistrantNote,
  type RegistrantStatus,
} from "@/lib/registrants.functions";
import { formatDateTime } from "@/lib/format";
import { Search, Check, X, Pause, Ban, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { useTelegramViewer } from "@/hooks/useTelegramViewer";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/registrants")({
  ssr: false,
  component: RegistrantsPage,
});

const statusColor: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  on_hold: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  approved: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  attended: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  denied: "bg-red-500/15 text-red-700 border-red-500/30",
  cancelled: "bg-slate-500/15 text-slate-700 border-slate-500/30",
};

const GROUP_ORDER: RegistrantStatus[] = ["pending", "on_hold", "approved", "denied", "cancelled", "attended"];
const GROUP_LABEL: Record<RegistrantStatus, string> = {
  pending: "Pending ≤3d",
  on_hold: "On hold >3d",
  approved: "Approved",
  denied: "Denied",
  cancelled: "Cancelled",
  attended: "Attended",
};

function RegistrantsPage() {
  const { telegramId, user } = useTelegramViewer();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<RegistrantStatus>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const groups = useQuery({
    queryKey: ["registrants", "grouped"],
    queryFn: () => groupedRegistrants(),
    refetchInterval: 5000,
  });

  const filtered = useMemo(() => {
    const g = groups.data;
    if (!g) return { pending: [], on_hold: [], approved: [], denied: [], cancelled: [], attended: [] } as Record<RegistrantStatus, any[]>;
    const needle = q.trim().toLowerCase();
    const filter = (rows: any[]) =>
      !needle ? rows : rows.filter((r) => [r.name, r.telegram_user, r.email].some((f) => (f ?? "").toLowerCase().includes(needle)));
    return {
      pending: filter(g.pending),
      on_hold: filter(g.on_hold),
      approved: filter(g.approved),
      denied: filter(g.denied),
      cancelled: filter(g.cancelled),
      attended: filter(g.attended),
    } as Record<RegistrantStatus, any[]>;
  }, [groups.data, q]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Registrants</CardTitle>
              <CardDescription>Grouped by status. Pending over 3 days automatically shows as On hold.</CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="w-64 pl-8" placeholder="Search name, handle, email…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as RegistrantStatus)}>
            <TabsList className="flex w-full flex-wrap justify-start gap-1">
              {GROUP_ORDER.map((g) => (
                <TabsTrigger key={g} value={g} className="gap-1.5">
                  {GROUP_LABEL[g]}
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">{filtered[g].length}</Badge>
                </TabsTrigger>
              ))}
            </TabsList>
            {GROUP_ORDER.map((g) => (
              <TabsContent key={g} value={g} className="mt-3">
                <ScrollArea className="h-[520px] pr-2">
                  <div className="space-y-1.5">
                    {filtered[g].length === 0 && (
                      <p className="p-4 text-center text-sm text-muted-foreground">No registrants in this group.</p>
                    )}
                    {filtered[g].map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setSelectedId(r.id)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-md border p-3 text-left transition hover:bg-accent",
                          selectedId === r.id && "border-primary bg-accent",
                        )}
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">{r.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {r.telegram_user} · {r.email}
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className={statusColor[r.status] ?? ""}>{r.status}</Badge>
                          <div className="mt-1 text-[10px] text-muted-foreground">{formatDateTime(r.registered_at)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <RegistrantDetail
        registrantId={selectedId}
        actorTelegramId={telegramId}
        actorName={user?.first_name ?? user?.username ?? "Admin"}
        onMutated={() => {
          qc.invalidateQueries({ queryKey: ["registrants"] });
          qc.invalidateQueries({ queryKey: ["stats"] });
        }}
      />
    </div>
  );
}

function RegistrantDetail({
  registrantId,
  actorTelegramId,
  actorName,
  onMutated,
}: {
  registrantId: string | null;
  actorTelegramId: number | null;
  actorName: string;
  onMutated: () => void;
}) {
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ["registrant-detail", registrantId],
    queryFn: () => getRegistrantDetail({ data: { registrantId: registrantId! } }),
    enabled: !!registrantId,
    refetchInterval: 4000,
  });

  const mutate = useMutation({
    mutationFn: (v: { status: RegistrantStatus }) =>
      updateRegistrantStatus({ data: { registrantId: registrantId!, status: v.status, actorTelegramId: actorTelegramId ?? 0 } }),
    onSuccess: (_d, v) => {
      toast.success(`Marked as ${v.status.replace("_", " ")}`);
      qc.invalidateQueries({ queryKey: ["registrant-detail", registrantId] });
      onMutated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [note, setNote] = useState("");
  const addNote = useMutation({
    mutationFn: () => addRegistrantNote({ data: { registrantId: registrantId!, body: note, actorTelegramId: actorTelegramId ?? 0, actorName } }),
    onSuccess: () => {
      setNote("");
      qc.invalidateQueries({ queryKey: ["registrant-detail", registrantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!registrantId) {
    return (
      <Card className="flex min-h-[300px] items-center justify-center">
        <p className="text-sm text-muted-foreground">Select a registrant to see details.</p>
      </Card>
    );
  }
  if (!detail.data) {
    return (
      <Card className="flex min-h-[300px] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </Card>
    );
  }

  const r = detail.data.registrant as any;
  const h = detail.data.history;
  const notes = detail.data.notes;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate">{r.name}</CardTitle>
            <CardDescription className="truncate">
              {r.telegram_user} · {r.email} · {r.phone}
            </CardDescription>
          </div>
          <Badge variant="outline" className={statusColor[r.status] ?? ""}>{r.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => mutate.mutate({ status: "approved" })} disabled={mutate.isPending}>
            <Check className="mr-1 h-4 w-4" />Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => mutate.mutate({ status: "on_hold" })} disabled={mutate.isPending}>
            <Pause className="mr-1 h-4 w-4" />On hold
          </Button>
          <Button size="sm" variant="outline" onClick={() => mutate.mutate({ status: "denied" })} disabled={mutate.isPending}>
            <X className="mr-1 h-4 w-4" />Deny
          </Button>
          <Button size="sm" variant="outline" onClick={() => mutate.mutate({ status: "cancelled" })} disabled={mutate.isPending}>
            <Ban className="mr-1 h-4 w-4" />Cancel
          </Button>
        </div>

        <Separator />

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">History</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md border p-2">
              <div className="text-xs text-muted-foreground">Prior registrations</div>
              <div className="text-xl font-semibold">{h.prior_count}</div>
            </div>
            <div className="rounded-md border p-2">
              <div className="text-xs text-muted-foreground">Name variants</div>
              <div className="truncate">{h.name_variants.join(" · ") || "—"}</div>
              <div className="mt-1 text-xs text-muted-foreground">Handles</div>
              <div className="truncate">{h.handle_variants.join(" · ") || "—"}</div>
            </div>
          </div>
          {h.past.length > 0 && (
            <ScrollArea className="max-h-40 rounded-md border">
              <ul className="divide-y">
                {h.past.map((p: any) => (
                  <li key={p.id} className="flex items-center justify-between p-2 text-xs">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{p.meetings?.topic ?? "Unknown meeting"}</div>
                      <div className="truncate text-muted-foreground">
                        {p.name} · {p.telegram_user} · {formatDateTime(p.registered_at)}
                      </div>
                    </div>
                    <Badge variant="outline" className={statusColor[p.status] ?? ""}>{p.status}</Badge>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </section>

        <Separator />

        <section className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <StickyNote className="h-4 w-4" /> Notes
          </h3>
          <ScrollArea className="max-h-48 rounded-md border p-2">
            <div className="space-y-2">
              {notes.length === 0 && <p className="text-xs text-muted-foreground">No notes yet.</p>}
              {notes.map((n: any) => (
                <div key={n.id} className="rounded-md bg-muted p-2 text-sm">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="font-semibold">{n.author_name}</span>
                    <span>{formatDateTime(n.created_at)}</span>
                  </div>
                  <div className="whitespace-pre-wrap">{n.body}</div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="space-y-2">
            <Textarea
              placeholder="Add a note about this registrant…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
            <Button size="sm" onClick={() => note.trim() && addNote.mutate()} disabled={!note.trim() || addNote.isPending}>
              Add note
            </Button>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

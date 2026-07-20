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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  groupedRegistrants,
  getRegistrantDetail,
  updateRegistrantStatus,
  addRegistrantNote,
  type RegistrantStatus,
} from "@/lib/registrants.functions";
import { listMeetings } from "@/lib/meetings.functions";
import { formatDateTime } from "@/lib/format";
import { Search, Check, X, Pause, Ban, StickyNote, Mail, Phone, MessageCircle, RotateCcw, Copy } from "lucide-react";
import { toast } from "sonner";
import { useTelegramViewer } from "@/hooks/useTelegramViewer";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/registrants")({
  ssr: false,
  component: RegistrantsPage,
});

type TabKey = RegistrantStatus | "all";

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

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}

function copy(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => toast.success(`Copied ${label}`)).catch(() => toast.error("Copy failed"));
}

function RegistrantsPage() {
  const { telegramId, user } = useTelegramViewer();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<TabKey>("pending");
  const [meetingId, setMeetingId] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const groups = useQuery({
    queryKey: ["registrants", "grouped"],
    queryFn: () => groupedRegistrants(),
    refetchInterval: 5000,
  });
  const meetings = useQuery({ queryKey: ["meetings"], queryFn: () => listMeetings() });

  const filtered = useMemo(() => {
    const g = groups.data;
    const empty = { pending: [], on_hold: [], approved: [], denied: [], cancelled: [], attended: [] } as Record<RegistrantStatus, any[]>;
    if (!g) return empty;
    const needle = q.trim().toLowerCase();
    const filter = (rows: any[]) =>
      rows.filter((r) => {
        if (meetingId !== "all" && r.meeting_id !== meetingId) return false;
        if (!needle) return true;
        return [r.name, r.telegram_user, r.email, r.phone].some((f) => (f ?? "").toLowerCase().includes(needle));
      });
    return {
      pending: filter(g.pending),
      on_hold: filter(g.on_hold),
      approved: filter(g.approved),
      denied: filter(g.denied),
      cancelled: filter(g.cancelled),
      attended: filter(g.attended),
    } as Record<RegistrantStatus, any[]>;
  }, [groups.data, q, meetingId]);

  const counts = filtered;
  const total = GROUP_ORDER.reduce((s, k) => s + counts[k].length, 0);
  const allRows = GROUP_ORDER.flatMap((k) => counts[k]);

  const listForTab = tab === "all" ? allRows : counts[tab];

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Registrants</CardTitle>
              <CardDescription>Grouped by status. Pending over 3 days automatically shows as On hold.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={meetingId} onValueChange={setMeetingId}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="All meetings" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All meetings</SelectItem>
                  {(meetings.data ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.topic}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="w-56 pl-8" placeholder="Search name, handle, email, phone…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Status summary chips */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setTab("all")}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition",
                tab === "all" ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
              )}
            >
              All <span className="ml-1 opacity-70">{total}</span>
            </button>
            {GROUP_ORDER.map((g) => (
              <button
                key={g}
                onClick={() => setTab(g)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition",
                  tab === g ? statusColor[g] + " border-current" : "hover:bg-accent",
                )}
              >
                {GROUP_LABEL[g]} <span className="ml-1 opacity-70">{counts[g].length}</span>
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
            <TabsList className="hidden">
              <TabsTrigger value="all">All</TabsTrigger>
              {GROUP_ORDER.map((g) => <TabsTrigger key={g} value={g}>{g}</TabsTrigger>)}
            </TabsList>
            <TabsContent value={tab} forceMount className="mt-0">
              <ScrollArea className="h-[560px] pr-2">
                <div className="space-y-1.5">
                  {listForTab.length === 0 && (
                    <p className="p-6 text-center text-sm text-muted-foreground">No registrants match.</p>
                  )}
                  {listForTab.map((r) => (
                    <RegistrantRow
                      key={r.id}
                      r={r}
                      active={selectedId === r.id}
                      onSelect={() => setSelectedId(r.id)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
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

function RegistrantRow({ r, active, onSelect }: { r: any; active: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-md border p-3 text-left transition hover:bg-accent",
        active && "border-primary bg-accent",
      )}
    >
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarFallback className="text-xs">{initials(r.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <div className="truncate font-medium">{r.name}</div>
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {r.telegram_user ? `@${r.telegram_user.replace(/^@/, "")} · ` : ""}{r.email}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <Badge variant="outline" className={statusColor[r.status] ?? ""}>{r.status}</Badge>
        <div className="mt-1 text-[10px] text-muted-foreground">{formatDateTime(r.registered_at)}</div>
      </div>
    </button>
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

  const [confirm, setConfirm] = useState<null | { status: RegistrantStatus; label: string }>(null);

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
  const meeting = r.meetings;
  const isReturning = h.prior_count > 0;

  const doStatus = (status: RegistrantStatus, label: string) => {
    if (status === "denied" || status === "cancelled") setConfirm({ status, label });
    else mutate.mutate({ status });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback>{initials(r.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="truncate text-base">{r.name}</CardTitle>
                <Badge variant="outline" className={statusColor[r.status] ?? ""}>{r.status}</Badge>
                {isReturning && <Badge variant="secondary">Returning ×{h.prior_count}</Badge>}
              </div>
              <CardDescription className="mt-0.5">
                Registered {formatDateTime(r.registered_at)}
                {meeting?.topic ? ` · for "${meeting.topic}"` : ""}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Contact block */}
          <div className="grid grid-cols-1 gap-1.5 rounded-md border p-3 text-sm sm:grid-cols-2">
            <ContactLine icon={MessageCircle} label="Telegram" value={r.telegram_user ? `@${r.telegram_user.replace(/^@/, "")}` : "—"} onCopy={r.telegram_user ? () => copy(r.telegram_user, "handle") : undefined} />
            <ContactLine icon={Mail} label="Email" value={r.email} onCopy={() => copy(r.email, "email")} />
            <ContactLine icon={Phone} label="Phone" value={r.phone ?? "—"} onCopy={r.phone ? () => copy(r.phone, "phone") : undefined} />
            <ContactLine icon={MessageCircle} label="TG ID" value={r.telegram_id ? String(r.telegram_id) : "—"} mono />
          </div>

          {/* Approval actions */}
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Approval</div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => doStatus("approved", "Approve")} disabled={mutate.isPending || r.status === "approved"}>
                <Check className="mr-1 h-4 w-4" />Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => doStatus("on_hold", "On hold")} disabled={mutate.isPending || r.status === "on_hold"}>
                <Pause className="mr-1 h-4 w-4" />On hold
              </Button>
              <Button size="sm" variant="outline" onClick={() => doStatus("denied", "Deny")} disabled={mutate.isPending}>
                <X className="mr-1 h-4 w-4" />Deny
              </Button>
              <Button size="sm" variant="outline" onClick={() => doStatus("cancelled", "Cancel")} disabled={mutate.isPending}>
                <Ban className="mr-1 h-4 w-4" />Cancel
              </Button>
              {r.status !== "pending" && (
                <Button size="sm" variant="ghost" onClick={() => mutate.mutate({ status: "pending" })} disabled={mutate.isPending}>
                  <RotateCcw className="mr-1 h-4 w-4" />Reset to pending
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* History */}
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

          {/* Notes */}
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

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.label} {r.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.status === "denied"
                ? "This will mark the registrant as denied and notify them on Telegram if linked."
                : "This will mark the registration as cancelled. The user will not receive an approval."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm) mutate.mutate({ status: confirm.status });
                setConfirm(null);
              }}
            >
              {confirm?.label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ContactLine({
  icon: Icon, label, value, mono, onCopy,
}: {
  icon: typeof Mail; label: string; value: string; mono?: boolean; onCopy?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn("truncate", mono && "font-mono text-xs")}>{value}</span>
      </div>
      {onCopy && (
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onCopy}>
          <Copy className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

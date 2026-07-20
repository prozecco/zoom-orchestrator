import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { type Registrant } from "@/lib/mock-data";
import { formatBangkokRegistrationTime } from "@/lib/time-formatter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Edit2, Trash2, Plus, AlertCircle, History, Smartphone, Globe, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  registrant: Registrant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusOptions = [
  { value: "pending", label: "Pending ⏳", color: "text-yellow-500" },
  { value: "approved", label: "Approved ✅", color: "text-green-500" },
  { value: "denied", label: "Denied ❌", color: "text-red-500" },
  { value: "cancelled", label: "Cancelled ⚪", color: "text-gray-400" },
  { value: "blacklisted", label: "Blacklisted 🚫", color: "text-red-800" },
];

export function RegistrantProfileSheet({ registrant, open, onOpenChange }: Props) {
  if (!registrant) return null;

  // Metadata Edit Modal States
  const [metaOpen, setMetaOpen] = useState(false);
  const [metaUsername, setMetaUsername] = useState(registrant.telegramUser);
  const [metaText, setMetaText] = useState(
    "After registering, please request approval at https://tr.ee/Approval1766 for faster approval, or contact @admin_tg."
  );

  // History Edit Modal States
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyMeetingId, setHistoryMeetingId] = useState("83483016779");
  const [historyZoomName, setHistoryZoomName] = useState(registrant.name);
  const [historyStatus, setHistoryStatus] = useState(registrant.status);

  // Save changes
  const saveMetadata = () => {
    toast.success("Linked metadata updated successfully!");
    setMetaOpen(false);
  };

  const saveHistory = () => {
    toast.success("Submission history entry updated!");
    setHistoryOpen(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto border-l-border/50 bg-background/95 backdrop-blur-xl">
          <SheetHeader className="mb-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12 bg-primary/20 text-primary font-bold">
                <AvatarFallback>{registrant.name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <SheetTitle className="text-xl">{registrant.name}</SheetTitle>
                  <Badge variant="outline" className="text-xs font-mono bg-muted/40">
                    {registrant.countryCode} {registrant.countryFlag}
                  </Badge>
                </div>
                <SheetDescription className="text-xs">Attendee Profile & Submission Details</SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="space-y-6">
            {/* Registration Source & Timestamp Header Banner */}
            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 p-3 text-xs">
              <div className="flex items-center gap-1.5">
                {registrant.source === "telegram_miniapp" ? (
                  <Badge variant="outline" className="text-[10px] border-sky-500/40 text-sky-300 bg-sky-500/15 flex items-center gap-1">
                    <Smartphone className="h-3 w-3" /> Telegram Mini App
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] border-blue-500/40 text-blue-300 bg-blue-600/15 flex items-center gap-1">
                    <Globe className="h-3 w-3" /> Zoom Web Portal
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono" title={new Date(registrant.registeredAt).toLocaleString()}>
                <Clock className="h-3 w-3 opacity-60" />
                <span>{formatBangkokRegistrationTime(registrant.registeredAt)}</span>
              </div>
            </div>

            {/* Basic Info */}
            <div className="space-y-4 text-sm">
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Zoom Name</div>
                <div className="font-medium flex items-center gap-2">
                  <span>{registrant.name}</span>
                  <span className="text-xs font-mono text-muted-foreground">({registrant.countryCode} {registrant.countryFlag})</span>
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Email Address</div>
                <div className="font-medium text-blue-400">{registrant.email}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Telegram Contact</div>
                <div className="font-medium text-sky-400 font-mono">{registrant.telegramUser}</div>
              </div>
            </div>

            {/* Current Status Dropdown */}
            <div className="space-y-2 rounded-lg border border-border/50 bg-muted/10 p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Status</div>
              <Select defaultValue={registrant.status}>
                <SelectTrigger className="w-full bg-background border-border/50 focus:ring-0">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="focus:bg-muted/50">
                      <span className={cn("font-medium", opt.color)}>{opt.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Linked Accounts & Metadata */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Linked Accounts & Metadata</div>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-primary hover:text-primary" onClick={() => setMetaOpen(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
              <div className="rounded-md border border-border/50 bg-muted/20 p-3 text-xs leading-relaxed space-y-2">
                <p className="opacity-80">
                  {metaText}
                </p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                  <div>
                    <span className="opacity-60">Telegram Username: </span>
                    <span className="font-mono text-sky-400">{metaUsername}</span>
                  </div>
                  <div className="flex gap-2 text-muted-foreground">
                    <Edit2 className="h-3.5 w-3.5 cursor-pointer hover:text-primary" onClick={() => setMetaOpen(true)} />
                    <Trash2 className="h-3.5 w-3.5 cursor-pointer hover:text-destructive" onClick={() => {
                      setMetaUsername("");
                      toast.success("Linked account removed.");
                    }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Behavior Notes */}
            <div className="space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Behavior Notes</div>
              <div className="text-xs text-muted-foreground mb-2">Add warnings, remarks, or behavioral notes for this profile.</div>
              <Textarea 
                className="resize-none h-24 bg-background border-border/50 text-xs focus:ring-0" 
                placeholder="Enter notes..."
              />
              <Button className="w-full bg-primary/20 text-primary hover:bg-primary/30 border border-primary/50 text-xs py-1.5" onClick={() => toast.success("Behavior notes saved.")}>
                Save Notes
              </Button>
            </div>

            {/* Submission History */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Submission History</div>
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs border-green-500/50 text-green-500 hover:bg-green-500/10" onClick={() => setHistoryOpen(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Add Entry
                </Button>
              </div>
              
              <div className="rounded-md border border-border/50 bg-muted/10 p-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-semibold text-xs">Meeting ID: {historyMeetingId}</div>
                  <Badge variant="outline" className="text-[9px] bg-yellow-500/20 text-yellow-500 border-yellow-500/30 uppercase">
                    {historyStatus}
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground space-y-1">
                  <div>Zoom Name: {historyZoomName} ({registrant.countryCode} {registrant.countryFlag})</div>
                  <div>Telegram: {metaUsername || registrant.telegramUser}</div>
                  <div className="font-mono text-[10px] flex items-center gap-1 text-muted-foreground/80">
                    <Clock className="h-3 w-3" /> Registered: {formatBangkokRegistrationTime(registrant.registeredAt)}
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-3 pt-3 border-t border-border/50">
                  <button className="flex items-center text-[10px] text-muted-foreground hover:text-primary transition-colors" onClick={() => setHistoryOpen(true)}>
                    <Edit2 className="h-3 w-3 mr-1" /> Edit
                  </button>
                  <button className="flex items-center text-[10px] text-muted-foreground hover:text-destructive transition-colors" onClick={() => toast.success("Submission entry deleted.")}>
                    <Trash2 className="h-3 w-3 mr-1" /> Delete
                  </button>
                </div>
              </div>
            </div>

            {/* Name Change History (Audit Alias) */}
            <div className="space-y-3 pt-4 border-t border-border/50">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name Alias History</div>
              </div>
              
              {registrant.aliasHistory && registrant.aliasHistory.length > 0 ? (
                <div className="space-y-2">
                  {registrant.aliasHistory.map((alias, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-xs bg-muted/20 p-2 rounded border border-border/50">
                      <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <div>Changed from <span className="font-semibold text-red-400">"{alias.oldName}"</span> to <span className="font-semibold text-green-400">"{alias.newName}"</span></div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">{formatBangkokRegistrationTime(alias.changedAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic bg-muted/10 p-3 rounded border border-border/30 text-center">
                  No name changes recorded for this user.
                </div>
              )}
            </div>

          </div>
        </SheetContent>
      </Sheet>

      {/* Edit Metadata Modal Dialog */}
      <Dialog open={metaOpen} onOpenChange={setMetaOpen}>
        <DialogContent className="sm:max-w-md bg-background/95 border-border/50 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>Edit Accounts & Metadata</DialogTitle>
            <DialogDescription>Modify Telegram handle and instructions for this registrant.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid gap-1.5">
              <Label htmlFor="meta-tg">Telegram Username</Label>
              <Input
                id="meta-tg"
                value={metaUsername}
                onChange={(e) => setMetaUsername(e.target.value)}
                className="bg-black/20 border-border/50 text-xs focus:ring-0 font-mono"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="meta-instruct">Instructions Text</Label>
              <Textarea
                id="meta-instruct"
                value={metaText}
                onChange={(e) => setMetaText(e.target.value)}
                className="bg-black/20 border-border/50 text-xs focus:ring-0 h-24 resize-none"
              />
            </div>
          </div>
          <DialogFooter className="pt-4 border-t border-border/50">
            <Button variant="ghost" onClick={() => setMetaOpen(false)} className="text-xs h-8">
              Cancel
            </Button>
            <Button onClick={saveMetadata} className="text-xs h-8">
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Submission History Modal Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-md bg-background/95 border-border/50 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>Edit Submission Entry</DialogTitle>
            <DialogDescription>Modify the details of this submission history record.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid gap-1.5">
              <Label htmlFor="hist-meetid">Meeting ID</Label>
              <Input
                id="hist-meetid"
                value={historyMeetingId}
                onChange={(e) => setHistoryMeetingId(e.target.value)}
                className="bg-black/20 border-border/50 text-xs focus:ring-0 font-mono"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="hist-name">Zoom Display Name</Label>
              <Input
                id="hist-name"
                value={historyZoomName}
                onChange={(e) => setHistoryZoomName(e.target.value)}
                className="bg-black/20 border-border/50 text-xs focus:ring-0"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Current Status</Label>
              <Select value={historyStatus} onValueChange={(val: any) => setHistoryStatus(val)}>
                <SelectTrigger className="w-full bg-black/20 border-border/50 focus:ring-0 text-xs h-8">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      <span className={cn("font-medium", opt.color)}>{opt.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="pt-4 border-t border-border/50">
            <Button variant="ghost" onClick={() => setHistoryOpen(false)} className="text-xs h-8">
              Cancel
            </Button>
            <Button onClick={saveHistory} className="text-xs h-8">
              Save Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

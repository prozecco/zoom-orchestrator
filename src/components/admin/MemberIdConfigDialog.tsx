import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Hash, ShieldAlert, Settings2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MemberIdConfigDialog({ open, onOpenChange }: Props) {
  const [pattern, setPattern] = useState("MBR-{YYYY}-{SEQ:4}");
  const [sequence, setSequence] = useState("101");
  const [reserved, setReserved] = useState("1-100");
  const [mode, setMode] = useState<"auto" | "manual">("auto");

  const handleSave = () => {
    toast.success("Member ID Configuration saved!");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-background/95 border-border/50 backdrop-blur-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
              <Hash className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-lg">Member ID Pattern Settings</DialogTitle>
              <DialogDescription className="text-xs">
                Configure Post-Approval Member ID generation and reserved ranges
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Mode Selection */}
          <div className="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-3">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Assignment Mode
            </Label>
            <RadioGroup value={mode} onValueChange={(val: any) => setMode(val)} className="flex gap-4 pt-1">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="auto" id="r-auto" />
                <Label htmlFor="r-auto" className="cursor-pointer font-normal">
                  Automatic (Pattern Sequence)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="manual" id="r-manual" />
                <Label htmlFor="r-manual" className="cursor-pointer font-normal">
                  Manual Entry
                </Label>
              </div>
            </RadioGroup>
          </div>

          {mode === "auto" && (
            <>
              {/* Pattern Template */}
              <div className="space-y-1.5">
                <Label htmlFor="pattern-input">Pattern Template</Label>
                <Input
                  id="pattern-input"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  placeholder="MBR-{YYYY}-{SEQ:4}"
                  className="bg-black/20 border-border/50 text-xs font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  Placeholders: <code className="text-primary">{`{YYYY}`}</code>, <code className="text-primary">{`{SEQ:4}`}</code>
                </p>
              </div>

              {/* Starting Sequence */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="seq-input">Current Sequence</Label>
                  <Input
                    id="seq-input"
                    type="number"
                    value={sequence}
                    onChange={(e) => setSequence(e.target.value)}
                    className="bg-black/20 border-border/50 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reserved-input">Reserved Ranges</Label>
                  <Input
                    id="reserved-input"
                    value={reserved}
                    onChange={(e) => setReserved(e.target.value)}
                    placeholder="1-100, 500-550"
                    className="bg-black/20 border-border/50 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 rounded border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-400">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>
                  Sequence numbers inside reserved ranges (e.g. 1-100) will be automatically skipped.
                </span>
              </div>
            </>
          )}

          {mode === "manual" && (
            <div className="rounded border border-blue-500/30 bg-blue-500/10 p-3 text-[11px] text-blue-300">
              Admin will manually enter a custom Member ID for each user during approval.
            </div>
          )}
        </div>

        <DialogFooter className="pt-3 border-t border-border/50">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-xs h-8">
            Cancel
          </Button>
          <Button onClick={handleSave} className="text-xs h-8">
            Save Pattern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

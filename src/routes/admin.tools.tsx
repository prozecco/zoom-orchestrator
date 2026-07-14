import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Megaphone, Download, KeyRound, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/admin/tools")({
  component: ToolsPage,
});

function ToolsPage() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <CardTitle>Broadcast</CardTitle>
          </div>
          <CardDescription>Send a Telegram message to all approved registrants</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea rows={4} placeholder="Your message…" />
          <Button className="w-full">Send broadcast</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <CardTitle>Set active meeting</CardTitle>
          </div>
          <CardDescription>Switch the meeting attendees register for</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Zoom meeting ID</Label>
            <Input placeholder="83483016779" className="font-mono" />
          </div>
          <Button className="w-full" variant="secondary">Update active meeting</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            <CardTitle>Export</CardTitle>
          </div>
          <CardDescription>Download data as CSV</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" className="w-full justify-start">Export registrants</Button>
          <Button variant="outline" className="w-full justify-start">Export audit log</Button>
          <Button variant="outline" className="w-full justify-start">Export schedule</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            <CardTitle>Integrations</CardTitle>
          </div>
          <CardDescription>Telegram & Zoom sync (wire up next)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Auto-approve registrants</div>
              <div className="text-xs text-muted-foreground">Skip manual review</div>
            </div>
            <Switch />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Notify group on join</div>
              <div className="text-xs text-muted-foreground">Post to NOTIFICATION_CHAT_ID</div>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Sync Zoom attendance</div>
              <div className="text-xs text-muted-foreground">Pull attended status hourly</div>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { activeMeeting } from "@/lib/mock-data";
import { toast } from "sonner";

export const Route = createFileRoute("/app/")({
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast.success("Registration submitted — awaiting approval");
      navigate({ to: "/app/status" });
    }, 600);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{activeMeeting.topic}</CardTitle>
              <CardDescription>Hosted by {activeMeeting.host}</CardDescription>
            </div>
            <Badge className="bg-emerald-500 hover:bg-emerald-500">Live</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Starts</div>
            <div className="font-medium">{new Date(activeMeeting.startTime).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Duration</div>
            <div className="font-medium">{activeMeeting.durationMin} min</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Register to attend</CardTitle>
          <CardDescription>Your request will be reviewed by the host</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" required placeholder="Jane Doe" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tg">Telegram handle</Label>
              <Input id="tg" required placeholder="@janedoe" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required placeholder="jane@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" required placeholder="+1 555 000 0000" />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit registration"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { activeMeeting } from "@/lib/mock-data";
import { CheckCircle2, Clock, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/app/status")({
  component: StatusPage,
});

function StatusPage() {
  // mocked as "approved"
  const status: "pending" | "approved" | "rejected" = "approved";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Your registration</CardTitle>
          <CardDescription>{activeMeeting.topic}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 rounded-md border p-4">
            {status === "approved" ? (
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            ) : (
              <Clock className="h-8 w-8 text-amber-500" />
            )}
            <div>
              <div className="text-lg font-semibold capitalize">{status}</div>
              <div className="text-sm text-muted-foreground">
                {status === "approved"
                  ? "You're all set. Join with the button below."
                  : "The host is reviewing your request. You'll be notified in Telegram."}
              </div>
            </div>
          </div>

          {status === "approved" && (
            <div className="space-y-2 rounded-md border p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Meeting ID</div>
                <div className="font-mono text-sm">{activeMeeting.id}</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Passcode</div>
                <div className="font-mono text-sm">{activeMeeting.passcode}</div>
              </div>
              <Button asChild className="mt-2 w-full">
                <a href={activeMeeting.joinUrl} target="_blank" rel="noreferrer">
                  Join Zoom meeting <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" asChild className="flex-1">
              <Link to="/app/chat">Open chat</Link>
            </Button>
            <Button variant="ghost" asChild className="flex-1">
              <Link to="/app">Re-register</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Badge variant="outline" className="w-full justify-center py-1.5">
        Notifications sent to your Telegram @user
      </Badge>
    </div>
  );
}

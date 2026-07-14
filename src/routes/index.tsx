import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Users, Video } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Meeting Hub — Telegram & Zoom Management" },
      { name: "description", content: "Dual-role Zoom meeting management: admin dashboard and attendee registration mini app." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Video className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Meeting Hub</h1>
            <p className="text-sm text-muted-foreground">Telegram Mini App · Zoom Management</p>
          </div>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <Card className="transition-shadow hover:shadow-lg">
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Shield className="h-5 w-5" />
              </div>
              <CardTitle className="mt-3">Admin Dashboard</CardTitle>
              <CardDescription>
                Host & administrator view. Manage meetings, registrants, live sessions, and audit history.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link to="/admin">Open admin</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-shadow hover:shadow-lg">
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <CardTitle className="mt-3">Attendee Mini App</CardTitle>
              <CardDescription>
                Register for the active meeting, check approval status, and chat live during the session.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="secondary" className="w-full">
                <Link to="/app">Open attendee view</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <p className="mt-12 text-center text-xs text-muted-foreground">
          Prototype with mock data. Zoom & Telegram integrations wire up next.
        </p>
      </div>
    </div>
  );
}

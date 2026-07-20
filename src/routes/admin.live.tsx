import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LiveChatModerationPanel } from "@/components/admin/LiveChatModerationPanel";
import { activeMeeting, registrants } from "@/lib/mock-data";
import { MicOff, VideoOff } from "lucide-react";

export const Route = createFileRoute("/admin/live")({
  ssr: false,
  component: LivePage,
});

function LivePage() {
  const attended = registrants.filter((r) => r.status === "approved" || r.status === "attended");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>{active.data?.topic ?? "No active meeting"}</CardTitle>
            <CardDescription>{active.data ? `Meeting ID ${active.data.zoom_id}` : "Sync a meeting to start"}</CardDescription>
          </div>
          <Badge className="bg-emerald-500 hover:bg-emerald-500 font-bold">● Live</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="aspect-video overflow-hidden rounded-md bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-6 text-slate-100 border border-border/50 shadow-inner">
            <div className="flex h-full flex-col justify-between">
              <div className="flex justify-between items-center text-xs opacity-70">
                <span>Live Video Stream</span>
                <span className="font-mono bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
                  HD 1080p
                </span>
              </div>
              <div>
                <div className="text-2xl font-semibold">{activeMeeting.host}</div>
                <div className="text-sm opacity-70">Speaking · {activeMeeting.attendees} attendees joined</div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline"><MicOff className="h-4 w-4 mr-1.5" /> Mute all</Button>
            <Button variant="outline"><VideoOff className="h-4 w-4 mr-1.5" /> Stop video</Button>
            <Button variant="destructive">End meeting</Button>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">Joined Attendees ({attended.length})</div>
            <div className="flex flex-wrap gap-2">
              {attended.map((a) => (
                <Badge key={a.id} variant={a.id === activeId ? "default" : "secondary"} className="cursor-pointer" onClick={() => setSelectedId(a.id)}>
                  {a.name}
                </Badge>
              ))}
              {attended.length === 0 && <p className="text-sm text-muted-foreground">No approved attendees yet.</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interactive Live Chat Moderation Panel */}
      <LiveChatModerationPanel />
    </div>
  );
}

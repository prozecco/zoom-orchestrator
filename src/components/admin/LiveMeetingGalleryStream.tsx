import { useState, useEffect } from "react";
import { Video, VideoOff, Mic, MicOff, Maximize2, RefreshCw, Volume2, ShieldCheck, Sparkles, Users, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GalleryParticipant {
  id: string;
  name: string;
  avatarUrl?: string;
  isSpeaking: boolean;
  isVideoOn: boolean;
  isMuted: boolean;
  role: "Host" | "Co-Host" | "Participant";
}

interface LiveMeetingGalleryStreamProps {
  topic: string;
  zoomId: string;
  liveCount: number;
  participants: Array<{ id: string; name: string; email?: string | null; telegram_user?: string | null }>;
}

export function LiveMeetingGalleryStream({ topic, zoomId, liveCount, participants }: LiveMeetingGalleryStreamProps) {
  const [activeTab, setActiveTab] = useState<"gallery" | "speaker">("gallery");
  const [isAudioLive, setIsAudioLive] = useState(true);
  const [activeSpeakerIndex, setActiveSpeakerIndex] = useState(0);

  // Generate simulated dynamic active gallery feeds from real participants
  const displayList: GalleryParticipant[] = (participants.length > 0 ? participants : [
    { id: "1", name: "izax619 (Host)", telegram_user: "izax619" },
    { id: "2", name: "iXUN_z (Co-Host)", telegram_user: "iXUN_z" },
    { id: "3", name: "Deven", telegram_user: "eddie_604" },
    { id: "4", name: "ho HKG", telegram_user: "whk119" },
  ])
    .slice(0, 6)
    .map((p, idx) => ({
      id: p.id,
      name: p.name || p.telegram_user || `Participant ${idx + 1}`,
      isSpeaking: idx === activeSpeakerIndex,
      isVideoOn: true,
      isMuted: idx !== activeSpeakerIndex,
      role: idx === 0 ? "Host" : idx === 1 ? "Co-Host" : "Participant",
    }));

  // Alternate active speaker animation
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSpeakerIndex((prev) => (prev + 1) % Math.max(1, displayList.length));
    }, 4000);
    return () => clearInterval(interval);
  }, [displayList.length]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-emerald-500/40 bg-slate-950 shadow-2xl transition-all">
      {/* Top Stream Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 px-4 py-2.5 border-b border-border/40 text-xs">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
          </span>
          <span className="font-bold text-slate-100 flex items-center gap-1">
            <Radio className="h-3.5 w-3.5 text-rose-400" /> LIVE STREAM PREVIEW
          </span>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-mono text-[10px]">
            720p HD · Gallery View
          </Badge>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant={activeTab === "gallery" ? "default" : "ghost"}
            onClick={() => setActiveTab("gallery")}
            className="h-6 text-[11px] px-2"
          >
            Gallery View
          </Button>
          <Button
            size="sm"
            variant={activeTab === "speaker" ? "default" : "ghost"}
            onClick={() => setActiveTab("speaker")}
            className="h-6 text-[11px] px-2"
          >
            Active Speaker
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsAudioLive(!isAudioLive)}
            className="h-6 w-6 p-0 text-slate-300 hover:text-white"
          >
            <Volume2 className={cn("h-3.5 w-3.5", !isAudioLive && "opacity-40")} />
          </Button>
        </div>
      </div>

      {/* Video Content Canvas */}
      <div className="p-3 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 min-h-[240px]">
        {activeTab === "gallery" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {displayList.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "relative aspect-video rounded-lg border overflow-hidden bg-slate-900 flex flex-col justify-between p-2 transition-all shadow-inner",
                  item.isSpeaking
                    ? "border-emerald-400 ring-2 ring-emerald-500/40 shadow-emerald-500/20"
                    : "border-slate-800"
                )}
              >
                {/* Simulated Webcam Avatar / Video Background */}
                <div className="absolute inset-0 bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-950 flex items-center justify-center opacity-80">
                  <div
                    className={cn(
                      "h-12 w-12 rounded-full flex items-center justify-center font-bold text-lg text-white shadow-md border",
                      item.isSpeaking
                        ? "bg-emerald-600 border-emerald-400 animate-pulse"
                        : "bg-slate-700 border-slate-600"
                    )}
                  >
                    {item.name.charAt(0).toUpperCase()}
                  </div>
                </div>

                {/* Top Badge Overlay */}
                <div className="relative z-10 flex justify-between items-center">
                  <Badge className="bg-black/60 text-slate-200 backdrop-blur-md text-[9px] px-1.5 py-0 border border-white/10 font-normal">
                    {item.role}
                  </Badge>
                  {item.isSpeaking && (
                    <Badge className="bg-emerald-500 text-slate-950 font-bold text-[9px] px-1.5 py-0 animate-pulse">
                      SPEAKING 🎙️
                    </Badge>
                  )}
                </div>

                {/* Bottom Overlay Info */}
                <div className="relative z-10 flex items-center justify-between bg-black/65 backdrop-blur-md rounded px-2 py-1 border border-white/10 text-[11px] text-white">
                  <span className="truncate max-w-[100px] font-semibold">{item.name}</span>
                  <div className="flex items-center gap-1">
                    {item.isMuted ? (
                      <MicOff className="h-3 w-3 text-rose-400" />
                    ) : (
                      <Mic className="h-3 w-3 text-emerald-400" />
                    )}
                    <Video className="h-3 w-3 text-sky-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Active Speaker Focused View */
          <div className="relative aspect-video rounded-lg border border-emerald-500/50 bg-slate-900 overflow-hidden flex flex-col justify-between p-4 shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900 to-emerald-950/40 flex items-center justify-center">
              <div className="text-center space-y-2">
                <div className="h-20 w-20 mx-auto rounded-full bg-emerald-600/30 border-2 border-emerald-400 flex items-center justify-center font-bold text-3xl text-emerald-300 shadow-xl animate-pulse">
                  {displayList[activeSpeakerIndex]?.name.charAt(0) || "Z"}
                </div>
                <div className="text-sm font-bold text-white">{displayList[activeSpeakerIndex]?.name || "Active Speaker"}</div>
                <Badge className="bg-emerald-500 text-slate-950 font-bold text-xs px-2.5 py-0.5">
                  🎙️ Active Speaker Spotlight
                </Badge>
              </div>
            </div>

            <div className="relative z-10 flex justify-between items-center">
              <Badge className="bg-black/70 text-slate-200 border border-white/10 text-xs">
                Meeting #{zoomId}
              </Badge>
              <Badge className="bg-emerald-500 text-slate-950 font-bold text-xs">
                {liveCount > 0 ? liveCount : 715} Live Participants
              </Badge>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Footer Info */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/80 px-4 py-2 border-t border-border/40 text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
          <span className="font-semibold text-slate-200">{topic}</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-emerald-400">
          <span>{liveCount > 0 ? liveCount : 715} active participants in room</span>
        </div>
      </div>
    </div>
  );
}

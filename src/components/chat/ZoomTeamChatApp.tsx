import { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  Video,
  Send,
  Users,
  Search,
  Plus,
  Star,
  AtSign,
  PhoneCall,
  UserPlus,
  Compass,
  Paperclip,
  Image,
  Mic,
  Camera,
  Code,
  Smile,
  MoreHorizontal,
  Home,
  Calendar,
  Contact,
  Layout,
  CheckCircle2,
  Lock,
  Radio,
  FileText
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  senderName: string;
  senderRole: "host" | "co-host" | "attendee";
  text: string;
  timestamp: string;
  reactions?: Record<string, number>;
  repliesCount?: number;
  fileUrl?: string;
  fileName?: string;
  isCodeBlock?: boolean;
}

interface ZoomTeamChatAppProps {
  meetingId?: string;
  meetingTopic?: string;
  zoomId?: string;
  participants?: Array<{ id: string; name: string; email?: string; telegram_user?: string }>;
  messages: Array<any>;
  onSendMessage: (text: string, options?: { isCodeBlock?: boolean; fileUrl?: string }) => void;
  currentUser: { name: string; role: "host" | "attendee"; telegramId?: number | null };
}

export function ZoomTeamChatApp({
  meetingTopic = "ＳＵＮＣＬＯＵＤＳ １７６６",
  zoomId = "85651598189",
  participants = [],
  messages = [],
  onSendMessage,
  currentUser
}: ZoomTeamChatAppProps) {
  const [activeTab, setActiveTab] = useState<"team-chat" | "home" | "meetings" | "contacts">("team-chat");
  const [selectedChannel, setSelectedChannel] = useState<string>("moodleTeam");
  const [selectedDM, setSelectedDM] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCodeFormatting, setShowCodeFormatting] = useState(false);
  const [reactionsMap, setReactionsMap] = useState<Record<string, Record<string, number>>>({});

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, draftText]);

  const handleSend = () => {
    if (!draftText.trim()) return;
    onSendMessage(draftText, { isCodeBlock: showCodeFormatting });
    setDraftText("");
    setShowCodeFormatting(false);
  };

  const toggleReaction = (msgId: string, emoji: string) => {
    setReactionsMap((prev) => {
      const current = prev[msgId] || { "👍": 1 };
      const nextCount = (current[emoji] || 0) + 1;
      return {
        ...prev,
        [msgId]: { ...current, [emoji]: nextCount }
      };
    });
  };

  const channelList = [
    { id: "moodleTeam", name: "moodleTeam", isStarred: true, isPrivate: false, members: 3 },
    { id: "central-room", name: "Central Meeting Chat", isStarred: true, isPrivate: false, members: participants.length || 715 },
    { id: "announcements", name: "Announcements & News", isStarred: false, isPrivate: true, members: 12 },
    { id: "tech-support", name: "Tech Support & Help", isStarred: false, isPrivate: false, members: 45 },
  ];

  return (
    <div className="flex h-[82vh] w-full overflow-hidden rounded-xl border border-border/60 bg-slate-950 text-slate-100 shadow-2xl">
      {/* 1. Top App Switcher Bar (Area A in Image 5) */}
      <div className="flex w-14 shrink-0 flex-col items-center justify-between border-r border-slate-800 bg-slate-900/90 py-3 text-slate-400">
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={() => setActiveTab("home")}
            className={cn("flex flex-col items-center gap-0.5 text-[10px] hover:text-white transition-colors", activeTab === "home" && "text-sky-400")}
          >
            <div className={cn("p-1.5 rounded-lg", activeTab === "home" && "bg-sky-500/20")}>
              <Home className="h-5 w-5" />
            </div>
            Home
          </button>

          <button
            onClick={() => setActiveTab("team-chat")}
            className={cn("flex flex-col items-center gap-0.5 text-[10px] font-bold hover:text-white transition-colors", activeTab === "team-chat" && "text-blue-400")}
          >
            <div className={cn("p-1.5 rounded-lg relative", activeTab === "team-chat" && "bg-blue-600 text-white shadow-md shadow-blue-500/30")}>
              <MessageSquare className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                3
              </span>
            </div>
            Team-Chat
          </button>

          <button
            onClick={() => setActiveTab("meetings")}
            className={cn("flex flex-col items-center gap-0.5 text-[10px] hover:text-white transition-colors", activeTab === "meetings" && "text-sky-400")}
          >
            <div className={cn("p-1.5 rounded-lg", activeTab === "meetings" && "bg-sky-500/20")}>
              <Video className="h-5 w-5" />
            </div>
            Meetings
          </button>

          <button
            onClick={() => setActiveTab("contacts")}
            className={cn("flex flex-col items-center gap-0.5 text-[10px] hover:text-white transition-colors", activeTab === "contacts" && "text-sky-400")}
          >
            <div className={cn("p-1.5 rounded-lg", activeTab === "contacts" && "bg-sky-500/20")}>
              <Contact className="h-5 w-5" />
            </div>
            Contacts
          </button>
        </div>

        <div className="flex flex-col items-center gap-3">
          <Avatar className="h-7 w-7 border border-blue-400/50">
            <AvatarFallback className="bg-blue-600 text-[10px] font-bold text-white">
              {currentUser.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* 2. Left Zoom Team Chat Sidebar (Navigation & Channels) */}
      <div className="flex w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900/60 text-slate-200">
        {/* Header Search & New Chat */}
        <div className="flex items-center justify-between border-b border-slate-800 p-3 gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search chats & channels"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 bg-slate-950/80 pl-8 font-mono text-xs border-slate-800 text-slate-200 placeholder:text-slate-500"
            />
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-400 hover:bg-blue-500/20">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable Navigation Sidebar */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4 text-xs scrollbar-thin">
          {/* Shortcuts */}
          <div className="space-y-0.5">
            <button className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-slate-400 hover:bg-slate-800/60 hover:text-slate-100">
              <AtSign className="h-3.5 w-3.5 text-sky-400" />
              <span>@ Mentions</span>
            </button>
            <button className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-slate-400 hover:bg-slate-800/60 hover:text-slate-100">
              <PhoneCall className="h-3.5 w-3.5 text-rose-400" />
              <span>Missed Calls</span>
            </button>
            <button className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-slate-400 hover:bg-slate-800/60 hover:text-slate-100">
              <div className="flex items-center gap-2.5">
                <Compass className="h-3.5 w-3.5 text-amber-400" />
                <span>First Steps</span>
              </div>
              <Badge className="bg-rose-500 text-white font-bold text-[9px] px-1.5 py-0">3</Badge>
            </button>
          </div>

          {/* Starred / Favorites Channels */}
          <div>
            <div className="px-2 py-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Starred</span>
              <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
            </div>
            <div className="space-y-0.5 mt-1">
              {channelList.filter((c) => c.isStarred).map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => { setSelectedChannel(ch.id); setSelectedDM(null); }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 font-medium transition-colors",
                    selectedChannel === ch.id && !selectedDM
                      ? "bg-blue-600 text-white shadow-sm font-semibold"
                      : "text-slate-300 hover:bg-slate-800/60"
                  )}
                >
                  <span className="font-mono text-slate-400">#</span>
                  <span className="truncate">{ch.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Direct Messages / 1:1 Chats */}
          <div>
            <div className="px-2 py-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Chats & Direct Messages</span>
              <Badge variant="outline" className="text-[9px] text-slate-400 border-slate-700">
                {participants.length || 715}
              </Badge>
            </div>
            <div className="space-y-0.5 mt-1">
              {(participants.length > 0 ? participants : [
                { id: "dm-1", name: "Sabine Helmke", telegram_user: "sabine_h" },
                { id: "dm-2", name: "Melanie Kirschner (Sie)", telegram_user: "melanie_k" },
                { id: "dm-3", name: "izax619 (Owner)", telegram_user: "izax619" },
              ]).map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedDM(p.id); }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 transition-colors",
                    selectedDM === p.id
                      ? "bg-blue-600 text-white shadow-sm font-semibold"
                      : "text-slate-300 hover:bg-slate-800/60"
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="bg-slate-800 text-[9px] font-bold text-slate-200">
                        {p.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 border border-slate-900" />
                  </div>
                  <span className="truncate text-xs">{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Channels List */}
          <div>
            <div className="px-2 py-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <span>Channels</span>
            </div>
            <div className="space-y-0.5 mt-1">
              {channelList.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => { setSelectedChannel(ch.id); setSelectedDM(null); }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-slate-300 hover:bg-slate-800/60 transition-colors",
                    selectedChannel === ch.id && !selectedDM && "bg-blue-600 text-white font-semibold"
                  )}
                >
                  <span className="font-mono text-slate-400">#</span>
                  <span className="truncate">{ch.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Chat Workspace & Message History */}
      <div className="flex flex-1 flex-col bg-slate-950">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 bg-slate-900/40">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span className="font-mono text-blue-400">#</span>
              {selectedDM
                ? `Direct Message with ${participants.find((p) => p.id === selectedDM)?.name || "Participant"}`
                : channelList.find((c) => c.id === selectedChannel)?.name || "moodleTeam"}
            </h2>
            <Badge variant="outline" className="bg-slate-800/60 text-slate-300 border-slate-700 text-[10px] font-mono">
              <Users className="h-3 w-3 mr-1 text-slate-400" />
              {selectedDM ? "1:1 Chat" : `${participants.length || 715} members`}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10">
              <Video className="h-3.5 w-3.5 mr-1" /> Start Video Call
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-white">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Message Thread History */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
          {/* Welcome Announcement Header */}
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3.5 text-xs text-blue-200 space-y-1">
            <div className="font-bold text-blue-300 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-blue-400" />
              Zoom Team Chat Server Connected
            </div>
            <p className="text-slate-300">
              You are connected to live in-meeting and direct team chat. Messages sync in real-time with Zoom Team Chat OAuth API.
            </p>
          </div>

          {/* Sample Interactive Native Zoom Messages */}
          <div className="flex items-start gap-3 group">
            <Avatar className="h-8 w-8 mt-0.5">
              <AvatarFallback className="bg-sky-600 text-white font-bold text-xs">M</AvatarFallback>
            </Avatar>
            <div className="space-y-1 max-w-[85%]">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-white">Melanie Kirschner</span>
                <span className="text-[10px] text-slate-500">6. Jan., 08:36</span>
              </div>
              <div className="rounded-lg bg-slate-900 border border-slate-800 p-3 text-xs text-slate-100 shadow-sm leading-relaxed">
                Test message in Zoom Team Chat channel. Welcome everyone to SUNCLOUDS 1766!
              </div>

              {/* Reactions Bar (C in Image 5) */}
              <div className="flex items-center gap-1 pt-1">
                <button
                  onClick={() => toggleReaction("msg-1", "👍")}
                  className="flex items-center gap-1 rounded-full bg-slate-800/80 px-2 py-0.5 text-[11px] text-slate-300 border border-slate-700 hover:bg-slate-700"
                >
                  <span>👍</span>
                  <span className="font-bold text-sky-400">{reactionsMap["msg-1"]?.["👍"] || 1}</span>
                </button>
                <button
                  onClick={() => toggleReaction("msg-1", "❤️")}
                  className="flex items-center gap-1 rounded-full bg-slate-800/80 px-2 py-0.5 text-[11px] text-slate-300 border border-slate-700 hover:bg-slate-700"
                >
                  <span>❤️</span>
                  <span className="font-bold text-rose-400">{reactionsMap["msg-1"]?.["❤️"] || 2}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Live Messages from Supabase DB */}
          {messages.map((m: any, idx: number) => {
            const isMe = m.from_name?.includes(currentUser.name) || m.from_role === currentUser.role;
            return (
              <div key={m.id || idx} className={cn("flex items-start gap-3 group", isMe && "flex-row-reverse")}>
                <Avatar className="h-8 w-8 mt-0.5">
                  <AvatarFallback className={cn("font-bold text-xs text-white", isMe ? "bg-blue-600" : "bg-emerald-600")}>
                    {m.from_name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>

                <div className={cn("space-y-1 max-w-[85%]", isMe && "items-end text-right")}>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-white">{m.from_name}</span>
                    <span className="text-[10px] text-slate-500">
                      {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Just now"}
                    </span>
                  </div>

                  <div
                    className={cn(
                      "rounded-lg p-3 text-xs leading-relaxed border shadow-sm",
                      isMe
                        ? "bg-blue-600 text-white border-blue-500"
                        : "bg-slate-900 text-slate-100 border-slate-800"
                    )}
                  >
                    {m.text}
                  </div>

                  <div className="flex items-center gap-1 pt-0.5">
                    <button
                      onClick={() => toggleReaction(m.id || String(idx), "👍")}
                      className="flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] text-slate-300 border border-slate-800 hover:border-slate-700"
                    >
                      <span>👍</span>
                      <span className="font-bold text-sky-400">{reactionsMap[m.id || String(idx)]?.["👍"] || 1}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          <div ref={chatEndRef} />
        </div>

        {/* 4. Bottom Native Zoom Composer & Rich Toolbar (1-7 in Image 5 & Area B) */}
        <div className="border-t border-slate-800 bg-slate-900/80 p-3 space-y-2">
          {/* Main Text Input Area */}
          <div className="relative">
            <textarea
              rows={2}
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={`Send message to #${selectedDM ? "direct-chat" : selectedChannel}... (Press Enter to send)`}
              className={cn(
                "w-full rounded-lg bg-slate-950 p-2.5 text-xs text-slate-100 placeholder:text-slate-500 border border-slate-800 focus:border-blue-500 focus:outline-none resize-none font-sans",
                showCodeFormatting && "font-mono text-emerald-300 bg-black"
              )}
            />

            <Button
              size="sm"
              onClick={handleSend}
              disabled={!draftText.trim()}
              className="absolute right-2.5 bottom-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs h-7 px-3 flex items-center gap-1 shadow"
            >
              <Send className="h-3.5 w-3.5" /> Send
            </Button>
          </div>

          {/* Authentic Zoom Toolbar Items 1-7 (Numbered 1-7 in Image 5) */}
          <div className="flex flex-wrap items-center justify-between border-t border-slate-800/80 pt-2 text-slate-400 text-xs">
            <div className="flex items-center gap-1">
              {/* 1: Rich Text Format */}
              <button
                title="1: Rich Text Formatting"
                onClick={() => toast.info("Rich text format mode active")}
                className="h-7 w-7 rounded flex items-center justify-center hover:bg-slate-800 hover:text-white"
              >
                <FileText className="h-4 w-4 text-sky-400" />
              </button>

              {/* 2: File Attachment */}
              <button
                title="2: Upload File / Document"
                onClick={() => toast.info("Select file attachment")}
                className="h-7 w-7 rounded flex items-center justify-center hover:bg-slate-800 hover:text-white"
              >
                <Paperclip className="h-4 w-4 text-emerald-400" />
              </button>

              {/* 3: Screenshot / Image */}
              <button
                title="3: Take Screenshot / Add Image"
                onClick={() => toast.info("Screenshot tool selected")}
                className="h-7 w-7 rounded flex items-center justify-center hover:bg-slate-800 hover:text-white"
              >
                <Image className="h-4 w-4 text-purple-400" />
              </button>

              {/* 4: Audio Voice Memo */}
              <button
                title="4: Record Voice Memo"
                onClick={() => toast.info("Voice memo recording initiated")}
                className="h-7 w-7 rounded flex items-center justify-center hover:bg-slate-800 hover:text-white"
              >
                <Mic className="h-4 w-4 text-amber-400" />
              </button>

              {/* 5: Micro-phone */}
              <button
                title="5: Audio Mute/Unmute"
                onClick={() => toast.info("Microphone toggled")}
                className="h-7 w-7 rounded flex items-center justify-center hover:bg-slate-800 hover:text-white"
              >
                <Mic className="h-4 w-4 text-rose-400" />
              </button>

              {/* 6: Camera Clip */}
              <button
                title="6: Video Note / Camera clip"
                onClick={() => toast.info("Camera video clip tool active")}
                className="h-7 w-7 rounded flex items-center justify-center hover:bg-slate-800 hover:text-white"
              >
                <Camera className="h-4 w-4 text-sky-400" />
              </button>

              {/* 7: Code snippet block </> */}
              <button
                title="7: </> Code Snippet Block"
                onClick={() => setShowCodeFormatting(!showCodeFormatting)}
                className={cn(
                  "h-7 w-7 rounded flex items-center justify-center hover:bg-slate-800 hover:text-white font-mono text-xs font-bold",
                  showCodeFormatting && "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                )}
              >
                <Code className="h-4 w-4" />
              </button>
            </div>

            <div className="text-[11px] text-slate-500 font-mono">
              Native Zoom Team Chat Protocol Active
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

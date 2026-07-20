import { createFileRoute, Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Video, ShieldCheck, ClipboardEdit, CircleCheck, MessageSquare, LogOut, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTelegram } from "@/hooks/useTelegram";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app")({
  ssr: false,
  head: () => ({ meta: [{ title: "Attendee — Meeting Hub" }] }),
  component: AppLayout,
});

const tabs = [
  { to: "/app", label: "My Status", icon: CircleCheck, exact: true },
  { to: "/app/messages", label: "Messages", icon: MessageSquare },
  { to: "/app/chat", label: "Live Chat", icon: Users },
];

function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { backButton, haptic, isTelegram } = useTelegram();

  // Wire up Telegram BackButton when not on the root /app page
  useEffect(() => {
    if (!backButton) return;

    const isRoot = pathname === "/app" || pathname === "/app/";

    if (isRoot) {
      backButton.hide();
    } else {
      backButton.show();
      const goBack = () => {
        haptic?.impactOccurred("light");
        navigate({ to: "/app" });
      };
      backButton.onClick(goBack);
      return () => {
        backButton.offClick(goBack);
      };
    }
  }, [backButton, pathname, navigate, haptic]);

  const handleExit = () => {
    haptic?.notificationOccurred("warning");
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Video className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Meeting Hub</div>
              <div className="text-xs text-muted-foreground">Attendee mini app</div>
            </div>
          </div>

          {/* Exit / Log Out Button for Attendee UI */}
          <Button variant="ghost" size="sm" onClick={handleExit} className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1">
            <LogOut className="h-4 w-4" /> Exit
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 border-t bg-background">
        <div className="mx-auto flex max-w-2xl">
          {tabs.map((t) => {
            const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                onClick={() => haptic?.selectionChanged()}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium border-t-2 transition-colors",
                  active ? "text-primary border-primary bg-primary/5" : "text-muted-foreground border-transparent hover:bg-muted/10",
                )}
              >
                <Icon className="h-5 w-5" />
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

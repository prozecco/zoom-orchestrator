import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Video, ArrowLeft, ClipboardEdit, CircleCheck, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app")({
  head: () => ({ meta: [{ title: "Attendee — Meeting Hub" }] }),
  component: AppLayout,
});

const tabs = [
  { to: "/app", label: "Register", icon: ClipboardEdit, exact: true },
  { to: "/app/status", label: "My status", icon: CircleCheck },
  { to: "/app/chat", label: "Live chat", icon: MessageSquare },
] as const;

function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Video className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">Meeting Hub</div>
            <div className="text-xs text-muted-foreground">Attendee mini app</div>
          </div>
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
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium",
                  active ? "text-primary" : "text-muted-foreground",
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

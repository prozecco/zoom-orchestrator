import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Shield, Home, Calendar, Info, Users, Radio, ScrollText, Wrench, ArrowLeft, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin Dashboard — Meeting Hub" }],
  }),
  component: AdminLayout,
});

const tabs: { to: string; label: string; icon: typeof Home; exact?: boolean }[] = [
  { to: "/admin", label: "Home", icon: Home, exact: true },
  { to: "/admin/registrants", label: "Users", icon: Users },
  { to: "/admin/chat", label: "Live Chat", icon: MessageSquare },
  { to: "/admin/live", label: "Live", icon: Radio },
  { to: "/admin/audit", label: "Audit", icon: ScrollText },
  { to: "/admin/tools", label: "Tools", icon: Wrench },
];

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Admin Dashboard</div>
              <div className="text-xs text-muted-foreground">Elena Ross · Owner</div>
            </div>
          </div>
          <span className="hidden rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 sm:inline-flex">
            ● Meeting live
          </span>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 pb-2">
          {tabs.map((t) => {
            const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

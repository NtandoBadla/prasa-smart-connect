import { createFileRoute, Outlet, useNavigate, Link, redirect } from "@tanstack/react-router";
import { Shield, LogOut, LayoutDashboard, ScanLine } from "lucide-react";

export const Route = createFileRoute("/security")({
  beforeLoad: ({ location }) => {
    if (!localStorage.getItem("security_token") && !location.pathname.startsWith("/security/login")) {
      throw redirect({ to: "/admin/login" });
    }
  },
  component: SecurityLayout,
});

function SecurityLayout() {
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem("security_token");
    navigate({ to: "/security/login" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-bold text-foreground">PRASA Security Portal</span>
        </div>
        <nav className="flex items-center gap-4">
          <Link
            to="/security"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            activeProps={{ className: "text-primary font-medium" }}
          >
            <ScanLine className="h-4 w-4" /> Scanner
          </Link>
          <Link
            to="/security/dashboard"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            activeProps={{ className: "text-primary font-medium" }}
          >
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-destructive hover:opacity-80"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </nav>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

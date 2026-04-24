import { Link } from "@tanstack/react-router";
import { Train, Menu, X } from "lucide-react";
import { useState } from "react";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/search", label: "Plan a Trip" },
  { to: "/tracking", label: "Live Trains" },
  { to: "/alerts", label: "Service Alerts" },
  { to: "/saved", label: "My Routes" },
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-md">
      {/* Top utility strip */}
      <div className="bg-primary-dark text-xs">
        <div className="container mx-auto flex h-8 items-center justify-between px-4">
          <span className="opacity-80">Passenger Rail Agency of South Africa</span>
          <span className="hidden sm:inline opacity-80">Call Centre: 0800 65 64 63</span>
        </div>
      </div>

      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-destructive">
            <Train className="h-6 w-6 text-destructive-foreground" />
          </div>
          <div className="leading-tight">
            <div className="text-lg font-bold tracking-tight">PRASA</div>
            <div className="text-[10px] uppercase tracking-widest opacity-80">Metrorail · Smart Commute</div>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-sm px-3 py-2 text-sm font-medium transition-colors hover:bg-primary-dark"
              activeProps={{ className: "rounded-sm px-3 py-2 text-sm font-medium bg-primary-dark border-b-2 border-destructive" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <button
          className="lg:hidden p-2"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <nav className="lg:hidden border-t border-primary-dark bg-primary">
          <div className="container mx-auto flex flex-col px-4 py-2">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="border-b border-primary-dark py-3 text-sm font-medium"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}

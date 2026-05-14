import { Link } from "@tanstack/react-router";
import { Train, Menu, X, ChevronDown } from "lucide-react";
import { useState } from "react";

const PRIMARY = [
  { to: "/", label: "Home" },
  { to: "/crowding", label: "Crowding Predictor" },
  { to: "/map", label: "Live Map" },
  { to: "/register", label: "Get Alerts" },
  
] as const;

const MORE = [
  { to: "/fares", label: "Fares & Tickets" },
  { to: "/news", label: "News" },
  { to: "/safety", label: "Safety & SOS" },
  { to: "/lost-found", label: "Lost & Found" },
  { to: "/admin", label: "Administrator" },
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-md">
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
          {PRIMARY.map((item) => (
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
          <div
            className="relative"
            onMouseEnter={() => setMoreOpen(true)}
            onMouseLeave={() => setMoreOpen(false)}
          >
            <button className="flex items-center gap-1 rounded-sm px-3 py-2 text-sm font-medium hover:bg-primary-dark">
              More <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-full w-56 rounded-md border border-border bg-card p-1 text-foreground shadow-elevated">
                {MORE.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="block rounded-sm px-3 py-2 text-sm hover:bg-secondary"
                    activeProps={{ className: "block rounded-sm px-3 py-2 text-sm bg-secondary font-semibold text-primary" }}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
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
            {[...PRIMARY, ...MORE].map((item) => (
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

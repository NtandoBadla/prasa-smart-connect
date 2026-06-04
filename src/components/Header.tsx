import { Link } from "@tanstack/react-router";
import { Menu, X, ChevronDown, Globe } from "lucide-react";
import { useState } from "react";
import { useLang, LANG_LABELS, type Lang } from "@/lib/i18n";

export function Header() {
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const { lang, setLang, t } = useLang();

  const LANGS = Object.entries(LANG_LABELS) as [Lang, string][];

  const PRIMARY = [
    { to: "/", label: t("home") },
    { to: "/crowding", label: t("crowding") },
    { to: "/map", label: t("liveMap") },
    { to: "/register", label: t("getAlerts") },
  ] as const;

  const MORE = [
    { to: "/fares", label: t("fares") },
    { to: "/news", label: t("news") },
    { to: "/safety", label: t("safety") },
    { to: "/lost-found", label: t("lostFound") },
    { to: "/tourist", label: t("touristMode") },
    { to: "/crime-map", label: t("crimeMap") },
  ] as const;

  return (
    <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-md">
      {/* TOP BAR */}
      <div className="bg-primary-dark text-xs">
        <div className="container mx-auto flex h-8 items-center justify-between px-4">
          <span className="opacity-80">Passenger Rail Agency of South Africa</span>
          <span className="hidden sm:inline opacity-80">Call Centre: 0800 65 64 63</span>
        </div>
      </div>

      {/* MAIN HEADER */}
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        {/* LOGO */}
        <Link to="/" className="flex items-center gap-3">
          <img src="/Train Logo.png" alt="PRASA Smart Connect Logo" className="h-16 w-16 object-contain" style={{ imageRendering: "crisp-edges" }} />
          <div className="leading-tight">
            <div className="text-lg font-bold tracking-tight">PRASA Smart Connect</div>
            <div className="text-[10px] uppercase tracking-widest opacity-80">{t("tagline")}</div>
          </div>
        </Link>

        {/* DESKTOP NAV */}
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

          {/* MORE DROPDOWN */}
          <div className="relative" onMouseEnter={() => setMoreOpen(true)} onMouseLeave={() => setMoreOpen(false)}>
            <button className="flex items-center gap-1 rounded-sm px-3 py-2 text-sm font-medium hover:bg-primary-dark">
              {t("more")} <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-full w-56 rounded-md border border-border bg-card p-1 text-foreground shadow-elevated">
                {MORE.map((item) => (
                  <Link key={item.to} to={item.to} className="block rounded-sm px-3 py-2 text-sm hover:bg-secondary" activeProps={{ className: "block rounded-sm px-3 py-2 text-sm bg-secondary font-semibold text-primary" }}>
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* LANGUAGE SWITCHER */}
          <div className="relative" onMouseEnter={() => setLangOpen(true)} onMouseLeave={() => setLangOpen(false)}>
            <button className="flex items-center gap-1.5 rounded-sm px-3 py-2 text-sm font-medium hover:bg-primary-dark" aria-label="Change language">
              <Globe className="h-4 w-4" />
              <span className="uppercase text-xs font-bold">{lang}</span>
            </button>
            {langOpen && (
              <div className="absolute right-0 top-full w-44 rounded-md border border-border bg-card p-1 text-foreground shadow-elevated">
                {LANGS.map(([code, label]) => (
                  <button
                    key={code}
                    onClick={() => { setLang(code); setLangOpen(false); }}
                    className={`flex w-full items-center justify-between rounded-sm px-3 py-2 text-sm hover:bg-secondary ${lang === code ? "font-semibold text-primary" : ""}`}
                  >
                    {label}
                    {lang === code && <span className="text-xs text-primary">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* MOBILE MENU BUTTON */}
        <div className="flex items-center gap-2 lg:hidden">
          {/* mobile language button */}
          <div className="relative">
            <button onClick={() => setLangOpen((o) => !o)} className="flex items-center gap-1 p-2" aria-label="Language">
              <Globe className="h-5 w-5" />
              <span className="uppercase text-xs font-bold">{lang}</span>
            </button>
            {langOpen && (
              <div className="absolute right-0 top-full w-44 rounded-md border border-border bg-card p-1 text-foreground shadow-elevated z-50">
                {LANGS.map(([code, label]) => (
                  <button key={code} onClick={() => { setLang(code); setLangOpen(false); }} className={`flex w-full items-center justify-between rounded-sm px-3 py-2 text-sm hover:bg-secondary ${lang === code ? "font-semibold text-primary" : ""}`}>
                    {label}
                    {lang === code && <span className="text-xs text-primary">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="p-2" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* MOBILE MENU */}
      {open && (
        <nav className="lg:hidden border-t border-primary-dark bg-primary">
          <div className="container mx-auto flex flex-col px-4 py-2">
            {[...PRIMARY, ...MORE].map((item) => (
              <Link key={item.to} to={item.to} onClick={() => setOpen(false)} className="border-b border-primary-dark py-3 text-sm font-medium">
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}

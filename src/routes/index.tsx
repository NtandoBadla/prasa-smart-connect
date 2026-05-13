import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AlertsBanner } from "@/components/AlertsBanner";
import { Chatbot } from "@/components/Chatbot";
import { RouteSearchForm } from "@/components/RouteSearchForm";
import { ALERTS, SCHEDULES } from "@/data/prasa";
import { Train, Sparkles, ShieldCheck, MapPin, Clock, ArrowRight, AlertTriangle, Info, AlertCircle } from "lucide-react";
import { analyzeWithVader } from "@/lib/vader";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PRASA — Smart Commute | Plan, Track, Travel" },
      { name: "description", content: "Plan trips, track Metrorail trains in real time and get instant service alerts across the Western Cape with the PRASA smart commuter platform." },
      { property: "og:title", content: "PRASA — Smart Commute" },
      { property: "og:description", content: "Plan trips, track Metrorail trains and get live alerts across the Western Cape." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const navigate = Route.useNavigate();
  const [, setQuick] = useState({ from: "", to: "" });

  const handleSearch = (from: string, to: string, time: string) => {
    setQuick({ from, to });
    navigate({ to: "/search", search: { from, to, time } });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <AlertsBanner />

      {/* Hero */}
      <section className="relative overflow-hidden bg-[image:var(--gradient-hero)] text-primary-foreground">
        <div className="container mx-auto grid gap-8 px-4 py-12 md:grid-cols-2 md:items-center md:py-20">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/90 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5" /> AI-powered commute
            </span>
            <h1 className="mt-4 text-4xl font-bold leading-tight md:text-5xl">
              Move smarter across the <span className="text-destructive">Western Cape</span>.
            </h1>
            <p className="mt-4 max-w-lg text-base opacity-90 md:text-lg">
              Plan your Metrorail trip, track trains in real time and get instant service alerts — all in one place.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/tracking" className="inline-flex items-center gap-2 rounded-sm bg-destructive px-5 py-3 text-sm font-semibold text-destructive-foreground hover:opacity-90">
                Live trains <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/alerts" className="inline-flex items-center gap-2 rounded-sm border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold backdrop-blur hover:bg-white/20">
                Service alerts
              </Link>
            </div>
          </div>

          <div className="relative flex items-center justify-center">
  <div
    className="absolute -inset-3 rounded-md bg-destructive/20 blur-2xl"
    aria-hidden
  />

  <img
    src="/new trainImage.png"
    alt="PRASA train"
    className="relative z-10 w-full max-w-md object-contain drop-shadow-2xl"
  />
</div>
        </div>
      </section>

      {/* Feature strip */}
      <section className="border-b border-border bg-secondary/50">
        <div className="container mx-auto grid gap-6 px-4 py-8 md:grid-cols-3">
          <Feature icon={<Train className="h-6 w-6" />} title="Smart route search" desc="No more PDFs — search any station to station in seconds." />
          <Feature icon={<MapPin className="h-6 w-6" />} title="Live train tracking" desc="See on-time and delayed services across all Metrorail lines." />
          <Feature icon={<ShieldCheck className="h-6 w-6" />} title="AI assistant" desc="Ask anything about trains, fares and routes in natural language." />
        </div>
      </section>

      {/* Live status preview */}
      <section className="container mx-auto px-4 py-12">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground md:text-3xl">Today's services</h2>
            <p className="mt-1 text-sm text-muted-foreground">A snapshot of departures from major stations.</p>
          </div>
          <Link to="/tracking" className="text-sm font-semibold text-primary hover:underline">See all →</Link>
        </div>
        <div className="mt-6 overflow-hidden rounded-md border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-primary text-primary-foreground">
              <tr className="text-left">
                <Th>Train</Th>
                <Th>Line</Th>
                <Th>Route</Th>
                <Th>Depart</Th>
                <Th>Arrive</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {SCHEDULES.slice(0, 6).map((t, i) => (
                <tr key={t.id} className={i % 2 === 0 ? "bg-card" : "bg-secondary/40"}>
                  <Td className="font-mono">#{t.trainNo}</Td>
                  <Td>{t.line}</Td>
                  <Td className="font-medium">{t.from} → {t.to}</Td>
                  <Td><Clock className="mr-1 inline h-3 w-3" />{t.departure}</Td>
                  <Td>{t.arrival}</Td>
                  <Td>
                    <StatusPill status={t.status} delay={t.delayMin} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Alerts preview */}
      <section className="container mx-auto px-4 pb-16">
        <h2 className="text-2xl font-bold text-foreground md:text-3xl">Service alerts</h2>
        <p className="mt-1 text-sm text-muted-foreground">Live updates from across the network.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {ALERTS.map((a) => {
            const Icon = a.level === "critical" ? AlertCircle : a.level === "warning" ? AlertTriangle : Info;
            const tone =
              a.level === "critical"
                ? "border-destructive/40 bg-destructive/5"
                : a.level === "warning"
                  ? "border-warning/40 bg-warning/10"
                  : "border-border bg-secondary/40";
            return (
              <article key={a.id} className={`rounded-md border p-4 ${tone}`}>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-destructive" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{a.line || "Network"}</span>
                </div>
                <h3 className="mt-2 font-semibold text-foreground">{a.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{a.message}</p>
              </article>
            );
          })}
        </div>
      </section>

      <Footer />
      <Chatbot />
    </div>
  );
}



function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-primary text-primary-foreground">{icon}</div>
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
function StatusPill({ status, delay }: { status: string; delay?: number }) {
  const cls =
    status === "On Time"
      ? "bg-success/15 text-success border-success/30"
      : status === "Delayed"
        ? "bg-warning/20 text-foreground border-warning/40"
        : "bg-destructive/15 text-destructive border-destructive/30";
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {status}{delay ? ` · +${delay}m` : ""}
    </span>
  );
}

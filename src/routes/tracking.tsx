import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AlertsBanner } from "@/components/AlertsBanner";
import { Chatbot } from "@/components/Chatbot";
import { SCHEDULES } from "@/data/prasa";
import { Activity, MapPin, Clock, RefreshCw } from "lucide-react";
import { ShareJourney } from "@/components/ShareJourney";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/tracking")({
  head: () => ({
    meta: [
      { title: "Live Trains — PRASA Smart Commute" },
      { name: "description", content: "Real-time positions, status and ETAs for Metrorail trains across the Western Cape." },
      { property: "og:title", content: "Live Trains — PRASA" },
      { property: "og:description", content: "Real-time positions and status for Metrorail trains." },
    ],
  }),
  component: TrackingPage,
});

function TrackingPage() {
  const { t } = useLang();
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    const i = setInterval(() => setTick((x) => x + 1), 6000);
    return () => {
      clearTimeout(t);
      clearInterval(i);
    };
  }, []);

  // Simulate progress along stops
  const trains = SCHEDULES.map((s, idx) => {
    const progress = ((tick + idx) % s.stops.length);
    const currentStop = s.stops[Math.min(progress, s.stops.length - 1)];
    const remaining = s.stops.length - progress - 1;
    const eta = remaining * Math.round(s.durationMin / s.stops.length);
    return { ...s, currentStop, progress, eta: Math.max(eta, 0) };
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <AlertsBanner />

      <section className="bg-primary text-primary-foreground">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-8">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
              <Activity className="h-6 w-6 text-destructive" />
              {t("liveTrackingTitle")}
            </h1>
            <p className="mt-1 text-sm opacity-90">{t("liveTrackingDesc")}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
            <RefreshCw className="h-3 w-3 animate-spin" /> {t("updatesEvery")}
          </span>
        </div>
      </section>

      <section className="container mx-auto flex-1 px-4 py-8">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-md border border-border bg-card" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {trains.map((train) => {
              const pct = ((train.progress + 1) / train.stops.length) * 100;
              const tone =
                train.status === "On Time"
                  ? "bg-success"
                  : train.status === "Delayed"
                    ? "bg-warning"
                    : "bg-destructive";
              return (
                <article key={train.id} className="rounded-md border border-border bg-card p-4 shadow-card">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-sm bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                          {train.line}
                        </span>
                        <span className="text-xs text-muted-foreground">#{train.trainNo}</span>
                      </div>
                      <h3 className="mt-1 font-semibold text-foreground">
                        {train.from} → {train.to}
                      </h3>
                    </div>
                    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-primary-foreground ${tone}`}>
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                      {train.status}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {t("nowAt")} <strong className="text-foreground">{train.currentStop}</strong></span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {t("eta")} {train.eta}m</span>
                    </div>
                    <div className="mt-2">
                      <ShareJourney from={train.from} currentStop={train.currentStop} to={train.to} etaMinutes={train.eta} trainNo={train.trainNo} line={train.line} />
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                      <div className={`h-full ${tone} transition-all duration-500`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-2 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span>{train.from}</span>
                      <span>{train.to}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <Footer />
      <Chatbot />
    </div>
  );
}

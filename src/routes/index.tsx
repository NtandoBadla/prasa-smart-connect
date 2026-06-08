import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AlertsBanner } from "@/components/AlertsBanner";
import { Chatbot } from "@/components/Chatbot";
import { Train, Sparkles, ShieldCheck, MapPin, ArrowRight, AlertCircle, AlertTriangle, Info, Megaphone, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";

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
  const { t } = useLang();
  const { data, isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: api.announcements,
    refetchInterval: 5 * 60 * 1000,
  });
  const notices = data?.notices ?? [];
  const adminUpdates = data?.adminUpdates ?? [];
  const total = notices.length + adminUpdates.length;

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
              {t("heroTitle").replace("Western Cape", "").trim()} <span className="text-destructive">Western Cape</span>.
            </h1>
            <p className="mt-4 max-w-lg text-base opacity-90 md:text-lg">
              {t("heroSub")}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/map" className="inline-flex items-center gap-2 rounded-sm bg-destructive px-5 py-3 text-sm font-semibold text-destructive-foreground hover:opacity-90">
                {t("liveTrains")} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/alerts" className="inline-flex items-center gap-2 rounded-sm border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold backdrop-blur hover:bg-white/20">
                {t("serviceAlerts")}
              </Link>
            </div>
          </div>

          <div className="relative flex items-center justify-center">
  <div
    className="absolute -inset-3 rounded-md bg-destructive/20 blur-2xl"
    aria-hidden
  />

  <img
    src="/train_2-removebg-preview.png"
    alt="PRASA train"
    className="relative z-10 w-full max-w-md object-contain drop-shadow-2xl"
  />
</div>
        </div>
      </section>

      {/* Feature strip */}
      <section className="border-b border-border bg-secondary/50">
        <div className="container mx-auto grid gap-6 px-4 py-8 md:grid-cols-3">
          <Feature icon={<Train className="h-6 w-6" />} title={t("featureSearchTitle")} desc={t("featureSearchDesc")} />
          <Feature icon={<MapPin className="h-6 w-6" />} title={t("featureTrackTitle")} desc={t("featureTrackDesc")} />
          <Feature icon={<ShieldCheck className="h-6 w-6" />} title={t("featureAITitle")} desc={t("featureAIDesc")} />
        </div>
      </section>


      {/* Announcements */}
      <section className="container mx-auto px-4 pb-16">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold text-foreground md:text-3xl">{t("announcements")}</h2>
          {isLoading && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t("announcementsDesc")}</p>
        {!isLoading && total === 0 && (
          <p className="mt-6 text-sm text-muted-foreground">{t("noAnnouncements")}</p>
        )}
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {adminUpdates.map((u) => (
            <article key={u.id} className="rounded-md border border-warning/40 bg-warning/10 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{u.line}</span>
              </div>
              <h3 className="mt-2 font-semibold text-foreground">Train #{u.train_no} — {u.status}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {u.station}{u.delay_min ? ` · +${u.delay_min} min delay` : ""}{u.reason ? ` — ${u.reason}` : ""}
              </p>
            </article>
          ))}
          {notices.map((n, i) => {
            const isAlert = /(cancel|suspend|no service)/i.test(n.body);
            const isWarning = /(delay|late|slow)/i.test(n.body);
            const Icon = isAlert ? AlertCircle : isWarning ? AlertTriangle : Info;
            const tone = isAlert
              ? "border-destructive/40 bg-destructive/5"
              : isWarning ? "border-warning/40 bg-warning/10"
              : "border-border bg-secondary/40";
            const iconColor = isAlert ? "text-destructive" : isWarning ? "text-warning" : "text-primary";
            return (
              <article key={i} className={`rounded-md border p-4 ${tone}`}>
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${iconColor}`} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{n.line}</span>
                </div>
                <p className="mt-2 text-sm text-foreground">{n.body}</p>
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

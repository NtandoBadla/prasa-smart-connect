import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Chatbot } from "@/components/Chatbot";
import { ALERTS } from "@/data/prasa";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Service Alerts — PRASA Smart Commute" },
      { name: "description", content: "Live Metrorail service alerts including delays, cancellations and maintenance updates across the Western Cape." },
      { property: "og:title", content: "Service Alerts — PRASA" },
      { property: "og:description", content: "Live Metrorail service alerts and disruptions." },
    ],
  }),
  component: AlertsPage,
});

const iconMap = { critical: AlertCircle, warning: AlertTriangle, info: Info };

function AlertsPage() {
  const { t } = useLang();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <section className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold md:text-3xl">{t("serviceAlertsTitle")}</h1>
          <p className="mt-1 text-sm opacity-90">{t("serviceAlertsDesc")}</p>
        </div>
      </section>

      <section className="container mx-auto flex-1 px-4 py-8">
        <div className="space-y-4">
          {ALERTS.map((a) => {
            const Icon = iconMap[a.level];
            const tone =
              a.level === "critical"
                ? "border-l-destructive bg-destructive/5"
                : a.level === "warning"
                  ? "border-l-warning bg-warning/10"
                  : "border-l-primary bg-secondary/40";
            return (
              <article key={a.id} className={`rounded-md border border-border border-l-4 bg-card p-5 shadow-card ${tone}`}>
                <div className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-5 w-5 text-destructive" />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-foreground">{a.title}</h2>
                      {a.line && (
                        <span className="rounded-sm bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                          {a.line}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{a.message}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("posted")} {new Date(a.postedAt).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                </div>
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

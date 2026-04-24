import { useMemo } from "react";
import { z } from "zod";
import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Chatbot } from "@/components/Chatbot";
import { RouteSearchForm } from "@/components/RouteSearchForm";
import { planTrip } from "@/data/extras";
import { Route as RouteIcon, ArrowDown, Clock, RefreshCw } from "lucide-react";

const searchSchema = z.object({
  from: z.string().optional().default(""),
  to: z.string().optional().default(""),
  time: z.string().optional().default(""),
});

export const Route = createFileRoute("/planner")({
  head: () => ({
    meta: [
      { title: "Trip Planner — PRASA Smart Commute" },
      { name: "description", content: "Plan multi-leg Metrorail journeys with transfers and connection times across the Western Cape." },
    ],
  }),
  validateSearch: searchSchema,
  component: PlannerPage,
});

function PlannerPage() {
  const navigate = Route.useNavigate();
  const { from, to, time } = Route.useSearch();
  const plans = useMemo(() => (from && to ? planTrip(from, to, time) : []), [from, to, time]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <section className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-8">
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
            <RouteIcon className="h-6 w-6 text-destructive" /> Trip planner
          </h1>
          <p className="mt-1 text-sm opacity-90">Multi-leg journeys with smart transfers via major hubs.</p>
        </div>
      </section>

      <section className="container mx-auto -mt-6 px-4">
        <RouteSearchForm
          initialFrom={from}
          initialTo={to}
          initialTime={time}
          onSearch={(f, t, ti) => navigate({ search: { from: f, to: t, time: ti } })}
        />
      </section>

      <section className="container mx-auto flex-1 px-4 py-8">
        {!from || !to ? (
          <p className="rounded-md border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
            Enter a journey above. The planner will offer direct services and one-transfer options.
          </p>
        ) : plans.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
            No journey found between {from} and {to}.
          </p>
        ) : (
          <ol className="space-y-4">
            {plans.map((p, i) => (
              <li key={i} className="rounded-md border border-border bg-card p-5 shadow-card">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {p.transfers === 0 ? "Direct" : `${p.transfers} transfer`}
                    </div>
                    <h3 className="text-lg font-bold text-foreground">
                      {p.departure} → {p.arrival}
                    </h3>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-4 w-4" /> {p.totalDuration} min
                    </span>
                    <span className="rounded-sm bg-primary px-2.5 py-1 font-bold text-primary-foreground">
                      R {p.totalFare.toFixed(2)}
                    </span>
                  </div>
                </header>

                <ol className="mt-4 space-y-2">
                  {p.legs.map((leg, j) => {
                    const t = leg.train;
                    return (
                      <li key={j}>
                        <div className="flex items-start gap-3 rounded-sm bg-secondary/40 p-3">
                          <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-destructive" />
                          <div className="flex-1 text-sm">
                            <div className="font-semibold text-foreground">
                              {t.from} → {t.to}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t.line} · #{t.trainNo} · Platform {t.platform} · {t.departure} – {t.arrival}
                            </div>
                          </div>
                        </div>
                        {j < p.legs.length - 1 && (
                          <div className="my-1 ml-5 flex items-center gap-2 text-xs text-warning">
                            <RefreshCw className="h-3 w-3" />
                            <ArrowDown className="h-3 w-3" />
                            Change at <strong className="text-foreground">{t.to}</strong>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </li>
            ))}
          </ol>
        )}
      </section>

      <Footer />
      <Chatbot />
    </div>
  );
}

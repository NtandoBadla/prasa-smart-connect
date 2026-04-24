import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Chatbot } from "@/components/Chatbot";
import { SCHEDULES } from "@/data/prasa";
import { getCrowding, bestCoach } from "@/data/extras";
import { Users, Sparkles } from "lucide-react";

export const Route = createFileRoute("/crowding")({
  head: () => ({
    meta: [
      { title: "Crowding & Best Coach — PRASA Smart Commute" },
      { name: "description", content: "AI-powered crowding predictions for Metrorail trains. See which coach is least busy before you board." },
    ],
  }),
  component: CrowdingPage,
});

function CrowdingPage() {
  const [trainId, setTrainId] = useState(SCHEDULES[0].id);
  const train = SCHEDULES.find((s) => s.id === trainId)!;
  const loads = useMemo(() => getCrowding(train.trainNo), [train.trainNo]);
  const best = bestCoach(loads);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <section className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-8">
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
            <Users className="h-6 w-6 text-destructive" /> Crowding & best coach
          </h1>
          <p className="mt-1 text-sm opacity-90">Skip the squeeze — board the least busy coach with AI predictions.</p>
        </div>
      </section>

      <section className="container mx-auto flex-1 px-4 py-8">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Choose a train</label>
          <select
            value={trainId}
            onChange={(e) => setTrainId(e.target.value)}
            className="rounded-sm border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
          >
            {SCHEDULES.map((s) => (
              <option key={s.id} value={s.id}>
                #{s.trainNo} · {s.from} → {s.to} · {s.departure}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-md border border-l-4 border-l-success border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-2 text-success">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">AI recommendation</span>
          </div>
          <h2 className="mt-1 text-lg font-bold text-foreground">
            Board <span className="text-success">Coach {best.coach}</span> — {best.level} occupancy ({best.load}% full)
          </h2>
          <p className="text-sm text-muted-foreground">
            Based on historical patterns and the current departure time.
          </p>
        </div>

        <div className="mt-6 rounded-md border border-border bg-card p-5 shadow-card">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Train layout — #{train.trainNo}</h3>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
            {loads.map((c) => {
              const tone =
                c.level === "Low" ? "bg-success" :
                c.level === "Moderate" ? "bg-warning" :
                c.level === "High" ? "bg-destructive/80" : "bg-destructive";
              const isBest = c.coach === best.coach;
              return (
                <div
                  key={c.coach}
                  className={`relative overflow-hidden rounded-md border-2 p-3 text-center text-primary-foreground ${tone} ${
                    isBest ? "border-foreground ring-2 ring-success" : "border-transparent"
                  }`}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wider opacity-90">Coach</div>
                  <div className="text-2xl font-bold">{c.coach}</div>
                  <div className="text-[11px] opacity-95">{c.load}%</div>
                  {isBest && (
                    <div className="mt-1 text-[9px] font-bold uppercase tracking-widest">Best</div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <Legend color="bg-success" label="Low (<40%)" />
            <Legend color="bg-warning" label="Moderate" />
            <Legend color="bg-destructive/80" label="High" />
            <Legend color="bg-destructive" label="Full" />
          </div>
        </div>
      </section>

      <Footer />
      <Chatbot />
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded-sm ${color}`} />
      {label}
    </span>
  );
}

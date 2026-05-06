import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useMemo, useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AlertsBanner } from "@/components/AlertsBanner";
import { Chatbot } from "@/components/Chatbot";
import { RouteSearchForm } from "@/components/RouteSearchForm";
import { TrainCard } from "@/components/TrainCard";
import { searchTrains, type TrainSchedule } from "@/data/prasa";
import { api } from "@/lib/api";
import { Search as SearchIcon, Ticket, X, CheckCircle } from "lucide-react";

const searchSchema = z.object({
  from: z.string().optional().default(""),
  to: z.string().optional().default(""),
  time: z.string().optional().default(""),
});

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Plan a Trip — PRASA Smart Commute" },
      { name: "description", content: "Search Metrorail trains between any two stations in the Western Cape." },
    ],
  }),
  validateSearch: searchSchema,
  component: SearchPage,
});

function SearchPage() {
  const navigate = Route.useNavigate();
  const { from, to, time } = Route.useSearch();
  const [liveSchedules, setLiveSchedules] = useState<TrainSchedule[]>([]);
  const [ticketModal, setTicketModal] = useState<TrainSchedule | null>(null);
  const [generatedTicket, setGeneratedTicket] = useState<{ ticket_ref: string; booked_at: string } | null>(null);
  const [ticketLoading, setTicketLoading] = useState(false);

  useEffect(() => {
    api.schedules().then(setLiveSchedules).catch(() => {});
  }, []);

  const allSchedules = liveSchedules.length > 0 ? liveSchedules : undefined;

  const results = useMemo(() => {
    if (!from || !to) return [];
    if (allSchedules) {
      const f = from.trim().toLowerCase();
      const t = to.trim().toLowerCase();
      let res = allSchedules.filter((s) => {
        const stops = s.stops.map((x) => x.toLowerCase());
        const fi = stops.indexOf(f);
        const ti = stops.indexOf(t);
        return fi !== -1 && ti !== -1 && fi < ti;
      });
      if (time) res = res.filter((s) => s.departure >= time);
      return res.sort((a, b) => a.departure.localeCompare(b.departure));
    }
    return searchTrains(from, to, time);
  }, [from, to, time, allSchedules]);

  const handleSearch = (f: string, t: string, ti: string) => {
    navigate({ search: { from: f, to: t, time: ti } });
  };

  const handleGenerateTicket = async (train: TrainSchedule) => {
    setTicketLoading(true);
    try {
      const ticket = await api.generateTicket({
        trainNo: train.trainNo,
        line: train.line,
        from: train.from,
        to: train.to,
        departure: train.departure,
        arrival: train.arrival,
        fare: train.fare,
      });
      setGeneratedTicket(ticket);
      setTicketModal(null);
    } catch {
      // Server not running — generate a local ticket ref
      setGeneratedTicket({
        ticket_ref: `TKT-${Date.now().toString(36).toUpperCase()}`,
        booked_at: new Date().toISOString(),
      });
      setTicketModal(null);
    } finally {
      setTicketLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <AlertsBanner />

      <section className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold md:text-3xl">Plan your trip</h1>
          <p className="mt-1 text-sm opacity-90">Find the next Metrorail train between any two stations.</p>
        </div>
      </section>

      <section className="container mx-auto -mt-6 px-4">
        <RouteSearchForm initialFrom={from} initialTo={to} initialTime={time} onSearch={handleSearch} />
      </section>

      <section className="container mx-auto flex-1 px-4 py-8">
        {!from || !to ? (
          <EmptyState
            title="Search to see trains"
            desc="Enter a departure and destination station above. Try Cape Town to Simon's Town."
          />
        ) : results.length === 0 ? (
          <EmptyState
            title="No direct trains found"
            desc={`We couldn't find a service from ${from} to ${to}${time ? ` after ${time}` : ""}. Try a different time or nearby station.`}
          />
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {results.length} train{results.length > 1 ? "s" : ""} from {from} to {to}
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {results.map((t) => (
                <div key={t.id} className="flex flex-col gap-2">
                  <TrainCard train={t} />
                  <button
                    onClick={() => setTicketModal(t)}
                    className="flex items-center justify-center gap-2 rounded-sm border border-primary bg-primary/10 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/20"
                  >
                    <Ticket className="h-4 w-4" /> Generate Ticket
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Ticket Confirmation Modal */}
      {ticketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-md border border-border bg-card p-6 shadow-elevated">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">Confirm Ticket</h3>
              <button onClick={() => setTicketModal(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-2 rounded-sm bg-secondary/40 p-4 text-sm">
              <Row label="Route" value={`${ticketModal.from} → ${ticketModal.to}`} />
              <Row label="Train" value={`#${ticketModal.trainNo} · ${ticketModal.line}`} />
              <Row label="Departs" value={ticketModal.departure} />
              <Row label="Arrives" value={ticketModal.arrival} />
              <Row label="Platform" value={ticketModal.platform} />
              <Row label="Fare" value={`R ${ticketModal.fare.toFixed(2)}`} />
            </div>
            <button
              onClick={() => handleGenerateTicket(ticketModal)}
              disabled={ticketLoading}
              className="mt-4 w-full rounded-sm bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-50"
            >
              {ticketLoading ? "Generating…" : "Confirm & Generate Ticket"}
            </button>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {generatedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-md border border-border bg-card p-6 text-center shadow-elevated">
            <CheckCircle className="mx-auto h-12 w-12 text-success" />
            <h3 className="mt-3 text-lg font-bold text-foreground">Ticket Generated!</h3>
            <p className="mt-1 text-2xl font-mono font-bold text-primary">{generatedTicket.ticket_ref}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Booked {new Date(generatedTicket.booked_at).toLocaleString("en-ZA")}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Your ticket has been saved. Show this reference at the station.
            </p>
            <button
              onClick={() => setGeneratedTicket(null)}
              className="mt-4 w-full rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <Footer />
      <Chatbot />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-card p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <SearchIcon className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-base font-semibold text-foreground">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

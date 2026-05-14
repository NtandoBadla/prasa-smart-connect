import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Chatbot } from "@/components/Chatbot";
import { api } from "@/lib/api";
import { downloadTicketPDF } from "@/lib/ticketPDF";
import { Ticket, Search, Calendar, Train, Download } from "lucide-react";

export const Route = createFileRoute("/tickets")({
  head: () => ({
    meta: [{ title: "My Tickets — PRASA Smart Commute" }],
  }),
  component: TicketsPage,
});

type TicketRecord = {
  id: string;
  ticket_ref: string;
  train_no: string;
  line: string;
  from_station: string;
  to_station: string;
  departure: string;
  arrival: string;
  fare: number;
  travel_class: string;
  booked_at: string;
};

async function downloadTicket(t: TicketRecord) {
  await downloadTicketPDF({
    ref: t.ticket_ref,
    from: t.from_station,
    to: t.to_station,
    trainNo: t.train_no,
    line: t.line,
    departure: t.departure,
    arrival: t.arrival,
    travelClass: t.travel_class,
    ticketType: "Single",
    fare: t.fare,
    bookedAt: new Date(t.booked_at).toLocaleString("en-ZA"),
    validDate: new Date(t.booked_at).toLocaleDateString("en-ZA"),
  });
}

function TicketsPage() {
  const [userId, setUserId] = useState("");
  const [inputId, setInputId] = useState("");
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchTickets = async (id: string) => {
    if (!id.trim()) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.ticketHistory(id.trim());
      setTickets(data);
      if (data.length === 0) setError("No tickets found for this user ID.");
    } catch {
      setError("Could not fetch tickets. Make sure the server is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <section className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-8">
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
            <Ticket className="h-6 w-6 text-destructive" /> My Tickets
          </h1>
          <p className="mt-1 text-sm opacity-90">View your generated digital tickets and booking history.</p>
        </div>
      </section>

      <section className="container mx-auto flex-1 px-4 py-8 space-y-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputId}
            onChange={(e) => setInputId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchTickets(inputId)}
            placeholder="Enter your User ID (UUID from registration)"
            className="flex-1 rounded-sm border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
          <button
            onClick={() => fetchTickets(inputId)}
            disabled={loading}
            className="flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Search className="h-4 w-4" /> {loading ? "Loading…" : "Search"}
          </button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {tickets.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {tickets.map((t) => (
              <article key={t.id} className="rounded-md border border-border bg-card p-5 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-mono text-lg font-bold text-primary">{t.ticket_ref}</span>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="rounded-sm bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">{t.line}</span>
                      <span className="text-xs text-muted-foreground">Train #{t.train_no}</span>
                    </div>
                  </div>
                  <Ticket className="h-6 w-6 text-muted-foreground" />
                </div>

                <div className="mt-3 flex items-center gap-2 text-base font-semibold text-foreground">
                  <Train className="h-4 w-4 text-destructive" />
                  {t.from_station} → {t.to_station}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-sm">
                  <Stat label="Departs" value={t.departure} />
                  <Stat label="Arrives" value={t.arrival} />
                  <Stat label="Class" value={t.travel_class} />
                  <Stat label="Fare" value={`R ${t.fare.toFixed(2)}`} />
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    Booked {new Date(t.booked_at).toLocaleString("en-ZA")}
                  </div>
                  <button
                    onClick={() => downloadTicket(t)}
                    className="inline-flex items-center gap-1 rounded-sm border border-primary px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                  >
                    <Download className="h-3 w-3" /> Download PDF
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {!loading && tickets.length === 0 && !error && (
          <div className="rounded-md border border-dashed border-border bg-card p-10 text-center">
            <Ticket className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Enter your User ID above to view your ticket history. Tickets are generated from the{" "}
              <a href="/search" className="font-semibold text-primary hover:underline">Plan a Trip</a> page.
            </p>
          </div>
        )}
      </section>

      <Footer />
      <Chatbot />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-semibold text-foreground">{value}</div>
    </div>
  );
}

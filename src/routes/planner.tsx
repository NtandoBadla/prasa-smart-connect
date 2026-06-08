import { useMemo, useState } from "react";
import { z } from "zod";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Chatbot } from "@/components/Chatbot";
import { RouteSearchForm } from "@/components/RouteSearchForm";
import { planTrip, type TripPlan } from "@/data/extras";
import { SCHEDULES } from "@/data/prasa";
import { useSavedRoutes } from "@/hooks/useSavedRoutes";
import { api } from "@/lib/api";
import { Route as RouteIcon, ArrowDown, Clock, RefreshCw, Ticket, Download, Star, ChevronDown, ChevronUp, Train, X, AlertTriangle, Loader2 } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

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

// ── Ticket generation & download ─────────────────────────────────────────────
type GeneratedTicket = {
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

function downloadTicket(ticket: GeneratedTicket, plan: TripPlan) {
  const legs = plan.legs
    .map(
      (l, i) =>
        `Leg ${i + 1}: ${l.train.from} → ${l.train.to}\n` +
        `  Train #${l.train.trainNo} | ${l.train.line}\n` +
        `  Departs ${l.train.departure} | Arrives ${l.train.arrival} | Platform ${l.train.platform}`,
    )
    .join("\n\n");

  const content = [
    "========================================",
    "       PRASA METRORAIL — TICKET",
    "========================================",
    `Ref:        ${ticket.ticket_ref}`,
    `Booked:     ${new Date(ticket.booked_at).toLocaleString("en-ZA")}`,
    `Class:      ${ticket.travel_class}`,
    `Route:      ${ticket.from_station} → ${ticket.to_station}`,
    `Departs:    ${ticket.departure}   Arrives: ${ticket.arrival}`,
    `Fare:       R ${ticket.fare.toFixed(2)}`,
    "",
    "── Journey Details ──────────────────────",
    legs,
    "",
    "========================================",
    "Valid for date of travel only.",
    "Please retain this ticket for inspection.",
    "========================================",
  ].join("\n");

  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${ticket.ticket_ref}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Stripe payment form (inline) ─────────────────────────────────────────────
function PlannerStripeForm({
  fare,
  onSuccess,
  onCancel,
}: {
  fare: number;
  onSuccess: (ticket: GeneratedTicket) => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [err, setErr] = useState("");

  // paymentIntentId is stored on the Elements context via the clientSecret;
  // we retrieve it from stripe after confirmation
  const handlePay = async () => {
    if (!stripe || !elements) return;
    setPaying(true);
    setErr("");
    try {
      const { error: submitErr } = await elements.submit();
      if (submitErr) { setErr(submitErr.message ?? "Validation failed"); return; }
      const { error, paymentIntent } = await stripe.confirmPayment({ elements, redirect: "if_required" });
      if (error) { setErr(error.message ?? "Payment failed"); return; }
      if (paymentIntent?.status === "succeeded") {
        const ticket = await api.confirmPayment(paymentIntent.id);
        onSuccess(ticket as unknown as GeneratedTicket);
      }
    } catch (e: any) {
      setErr(e.message ?? "Payment error");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="space-y-4">
      <PaymentElement />
      {err && <p className="text-sm text-destructive">{err}</p>}
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 rounded-sm border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-secondary">Cancel</button>
        <button
          onClick={handlePay}
          disabled={paying || !stripe}
          className="flex flex-1 items-center justify-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
          {paying ? "Processing…" : `Pay R ${fare.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}

// ── Trip plan card with booking ───────────────────────────────────────────────
function PlanCard({ plan, index }: { plan: TripPlan; index: number }) {
  const [ticket, setTicket] = useState<GeneratedTicket | null>(null);
  const [paymentSecret, setPaymentSecret] = useState<string | null>(null);
  const [initiating, setInitiating] = useState(false);
  const [error, setError] = useState("");

  async function openPayment() {
    setInitiating(true);
    setError("");
    try {
      const firstLeg = plan.legs[0].train;
      const lastLeg = plan.legs[plan.legs.length - 1].train;
      const { clientSecret } = await api.createPaymentIntent({
        trainNo: firstLeg.trainNo,
        line: firstLeg.line,
        from: firstLeg.from,
        to: lastLeg.to,
        departure: plan.departure,
        arrival: plan.arrival,
        fare: plan.totalFare,
        travelClass: "Metro",
      });
      setPaymentSecret(clientSecret);
    } catch (e: any) {
      setError(e.message ?? "Could not initiate payment.");
    } finally {
      setInitiating(false);
    }
  }

  return (
    <li className="rounded-md border border-border bg-card p-5 shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {plan.transfers === 0 ? "Direct" : `${plan.transfers} transfer`} · Option {index + 1}
          </div>
          <h3 className="text-lg font-bold text-foreground">
            {plan.departure} → {plan.arrival}
          </h3>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-4 w-4" /> {plan.totalDuration} min
          </span>
          <span className="rounded-sm bg-primary px-2.5 py-1 font-bold text-primary-foreground">
            R {plan.totalFare.toFixed(2)}
          </span>
        </div>
      </header>

      <ol className="mt-4 space-y-2">
        {plan.legs.map((leg, j) => {
          const t = leg.train;
          return (
            <li key={j}>
              <div className="flex items-start gap-3 rounded-sm bg-secondary/40 p-3">
                <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-destructive" />
                <div className="flex-1 text-sm">
                  <div className="font-semibold text-foreground">{t.from} → {t.to}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.line} · #{t.trainNo} · Platform {t.platform} · {t.departure} – {t.arrival}
                  </div>
                </div>
              </div>
              {j < plan.legs.length - 1 && (
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

      {/* Ticket area */}
      {ticket ? (
        <div className="mt-4 rounded-sm border border-success/40 bg-success/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-success">Ticket issued</p>
              <p className="mt-0.5 font-mono text-lg font-bold text-foreground">{ticket.ticket_ref}</p>
              <p className="text-xs text-muted-foreground">
                {ticket.travel_class} · R {ticket.fare.toFixed(2)} · {new Date(ticket.booked_at).toLocaleString("en-ZA")}
              </p>
            </div>
            <button
              onClick={() => downloadTicket(ticket, plan)}
              className="flex items-center gap-1.5 rounded-sm bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <Download className="h-4 w-4" /> Download
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Ticket saved to <Link to="/tickets" className="underline hover:text-foreground">My Tickets</Link>
          </p>
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex items-center gap-3">
            <button
              onClick={openPayment}
              disabled={initiating}
              className="flex items-center gap-2 rounded-sm bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-60"
            >
              <Ticket className="h-4 w-4" />
              {initiating ? "Loading…" : "Book & pay"}
            </button>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          {/* Payment modal */}
          {paymentSecret && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-md border border-border bg-card p-6 shadow-elevated">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-foreground">Pay for Ticket</h3>
                  <button onClick={() => setPaymentSecret(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="mb-4 space-y-1 rounded-sm bg-secondary/40 p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Route</span>
                    <span className="font-semibold">{plan.legs[0].train.from} → {plan.legs[plan.legs.length - 1].train.to}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fare</span>
                    <span className="font-semibold">R {plan.totalFare.toFixed(2)}</span>
                  </div>
                </div>
                {stripePromise ? (
                  <Elements stripe={stripePromise} options={{ clientSecret: paymentSecret, appearance: { theme: "stripe" } }}>
                    <PlannerStripeForm
                      fare={plan.totalFare}
                      onSuccess={(t) => { setTicket(t); setPaymentSecret(null); }}
                      onCancel={() => setPaymentSecret(null)}
                    />
                  </Elements>
                ) : (
                  <div className="rounded-sm border border-warning/40 bg-warning/10 p-3 text-sm">
                    <AlertTriangle className="inline h-4 w-4 text-warning mr-1" />
                    Stripe is not configured. Add <code className="text-xs">VITE_STRIPE_PUBLISHABLE_KEY</code> to your .env file.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

// ── Full timetable for a route ────────────────────────────────────────────────
function RouteTimetable({ from, to }: { from: string; to: string }) {
  const [open, setOpen] = useState(false);
  const allTrains = useMemo(() => {
    const f = from.trim().toLowerCase();
    const t = to.trim().toLowerCase();
    return SCHEDULES.filter((s) => {
      const stops = s.stops.map((x) => x.toLowerCase());
      const fi = stops.indexOf(f);
      const ti = stops.indexOf(t);
      return fi !== -1 && ti !== -1 && fi < ti;
    }).sort((a, b) => a.departure.localeCompare(b.departure));
  }, [from, to]);

  if (allTrains.length === 0) return null;

  return (
    <div className="rounded-md border border-border bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-foreground hover:bg-secondary/40"
      >
        <span className="flex items-center gap-2">
          <Train className="h-4 w-4 text-primary" />
          Full timetable — {from} → {to} ({allTrains.length} services)
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Train</th>
                <th className="px-4 py-2 text-left">Line</th>
                <th className="px-4 py-2 text-left">Departs</th>
                <th className="px-4 py-2 text-left">Arrives</th>
                <th className="px-4 py-2 text-left">Platform</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Fare</th>
              </tr>
            </thead>
            <tbody>
              {allTrains.map((t) => (
                <tr key={t.id} className="border-t border-border hover:bg-secondary/30">
                  <td className="px-4 py-2 font-mono text-xs">#{t.trainNo}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{t.line}</td>
                  <td className="px-4 py-2 font-semibold">{t.departure}</td>
                  <td className="px-4 py-2">{t.arrival}</td>
                  <td className="px-4 py-2">{t.platform}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      t.status === "On Time" ? "bg-success/15 text-success" :
                      t.status === "Delayed" ? "bg-warning/20 text-foreground" :
                      "bg-destructive/15 text-destructive"
                    }`}>
                      {t.status}{t.delayMin ? ` +${t.delayMin}m` : ""}
                    </span>
                  </td>
                  <td className="px-4 py-2">R {t.fare.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Saved routes panel ────────────────────────────────────────────────────────
function SavedRoutesPanel({ currentFrom, currentTo }: { currentFrom: string; currentTo: string }) {
  const { routes } = useSavedRoutes();
  if (routes.length === 0) return null;

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Star className="h-4 w-4 text-destructive" /> Your saved routes
      </h3>
      <div className="flex flex-wrap gap-2">
        {routes.map((r) => {
          const active = r.from.toLowerCase() === currentFrom.toLowerCase() && r.to.toLowerCase() === currentTo.toLowerCase();
          return (
            <Link
              key={`${r.from}-${r.to}`}
              to="/planner"
              search={{ from: r.from, to: r.to, time: "" }}
              className={`rounded-sm border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-secondary"
              }`}
            >
              {r.from} → {r.to}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

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

      <section className="container mx-auto flex-1 space-y-6 px-4 py-8">
        {/* Saved routes for subscribed/returning users */}
        <SavedRoutesPanel currentFrom={from} currentTo={to} />

        {!from || !to ? (
          <p className="rounded-md border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
            Enter a journey above. The planner will offer direct services and one-transfer options.
          </p>
        ) : (
          <>
            {plans.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
                No journey found between {from} and {to}.
              </p>
            ) : (
              <ol className="space-y-4">
                {plans.map((p, i) => (
                  <PlanCard key={i} plan={p} index={i} />
                ))}
              </ol>
            )}

            {/* Always show full timetable even if no match at chosen time */}
            <RouteTimetable from={from} to={to} />
          </>
        )}
      </section>

      <Footer />
      <Chatbot />
    </div>
  );
}

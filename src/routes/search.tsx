import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useMemo, useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AlertsBanner } from "@/components/AlertsBanner";
import { Chatbot } from "@/components/Chatbot";
import { RouteSearchForm } from "@/components/RouteSearchForm";
import { TrainCard } from "@/components/TrainCard";
import { searchTrains, SCHEDULES, type TrainSchedule } from "@/data/prasa";
import { api } from "@/lib/api";
import { Search as SearchIcon, Ticket, X, CheckCircle, Clock, Loader2 } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { stripePromise } from "@/lib/stripe";

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

function matchRoute(schedules: TrainSchedule[], from: string, to: string): TrainSchedule[] {
  const f = from.trim().toLowerCase();
  const t = to.trim().toLowerCase();
  return schedules
    .filter((s) => {
      const stops = s.stops.map((x) => x.toLowerCase());
      const fi = stops.indexOf(f);
      const ti = stops.indexOf(t);
      return fi !== -1 && ti !== -1 && fi < ti;
    })
    .sort((a, b) => a.departure.localeCompare(b.departure));
}

function SearchPage() {
  const { t } = useLang();
  const navigate = Route.useNavigate();
  const { from, to, time } = Route.useSearch();
  const [liveSchedules, setLiveSchedules] = useState<TrainSchedule[]>([]);
  const [ticketModal, setTicketModal] = useState<TrainSchedule | null>(null);
  const [generatedTicket, setGeneratedTicket] = useState<{ ticket_ref: string; booked_at: string } | null>(null);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [passengerForm, setPassengerForm] = useState({ name: "", idNumber: "", email: "", phone: "" });
  const [passengerStep, setPassengerStep] = useState<TrainSchedule | null>(null);

  useEffect(() => {
    api.schedules().then(setLiveSchedules).catch(() => {});
  }, []);

  const { results, isWrapped, noRoute } = useMemo(() => {
    if (!from || !to) return { results: [], isWrapped: false, noRoute: false };

    const pool = liveSchedules.length > 0 ? liveSchedules : SCHEDULES;
    const allOnRoute = matchRoute(pool, from, to);

    if (allOnRoute.length === 0) return { results: [], isWrapped: false, noRoute: true };
    if (!time) return { results: allOnRoute, isWrapped: false, noRoute: false };

    const afterTime = allOnRoute.filter((s) => s.departure >= time);
    if (afterTime.length > 0) return { results: afterTime, isWrapped: false, noRoute: false };

    // No trains after requested time — show all trains on the route
    return { results: allOnRoute, isWrapped: true, noRoute: false };
  }, [from, to, time, liveSchedules]);

  const handleSearch = (f: string, t: string, ti: string) => {
    navigate({ search: { from: f, to: t, time: ti } });
  };

  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const [paymentTicketRef, setPaymentTicketRef] = useState("");

  // Step 1: open passenger details form
  const handleOpenPayment = (train: TrainSchedule) => {
    setPassengerForm({ name: "", idNumber: "", email: "", phone: "" });
    setPassengerStep(train);
  };

  // Step 2: confirmed passenger details — proceed to payment or direct generate
  const handleConfirmPassenger = async (train: TrainSchedule) => {
    if (!stripePromise) {
      setTicketLoading(true);
      try {
        const ticket = await api.generateTicket({
          trainNo: train.trainNo, line: train.line,
          from: train.from, to: train.to,
          departure: train.departure, arrival: train.arrival, fare: train.fare,
          passengerName: passengerForm.name || undefined,
          idNumber: passengerForm.idNumber || undefined,
          email: passengerForm.email || undefined,
          phone: passengerForm.phone || undefined,
        });
        setPassengerStep(null);
        setGeneratedTicket({ ticket_ref: ticket.ticket_ref, booked_at: ticket.booked_at });
      } catch (e: any) {
        alert(e.message ?? "Could not generate ticket.");
      } finally {
        setTicketLoading(false);
      }
      return;
    }
    setTicketLoading(true);
    try {
      const { clientSecret, ticketRef } = await api.createPaymentIntent({
        trainNo: train.trainNo, line: train.line,
        from: train.from, to: train.to,
        departure: train.departure, arrival: train.arrival, fare: train.fare,
        passengerName: passengerForm.name || undefined,
        idNumber: passengerForm.idNumber || undefined,
        email: passengerForm.email || undefined,
        phone: passengerForm.phone || undefined,
      });
      setPaymentClientSecret(clientSecret);
      setPaymentTicketRef(ticketRef);
      setPassengerStep(null);
      setTicketModal(train);
    } catch (e: any) {
      alert(e.message ?? "Could not initiate payment.");
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
          <h1 className="text-2xl font-bold md:text-3xl">{t("planTrip")}</h1>
          <p className="mt-1 text-sm opacity-90">{t("planTripDesc")}</p>
        </div>
      </section>

      <section className="container mx-auto -mt-6 px-4">
        <RouteSearchForm initialFrom={from} initialTo={to} initialTime={time} onSearch={handleSearch} />
      </section>

      <section className="container mx-auto flex-1 px-4 py-8">
        {!from || !to ? (
          <EmptyState title={t("searchToSee")} desc={t("searchToSeeDesc")} />
        ) : noRoute ? (
          <EmptyState title={t("noService")} desc={t("noServiceDesc").replace("{from}", from).replace("{to}", to)} />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-foreground">
                {results.length} train{results.length > 1 ? "s" : ""} from {from} to {to}
              </h2>
              {isWrapped && (
                <div className="flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-xs font-semibold text-warning">
                  <Clock className="h-3.5 w-3.5" />
                  No trains after {time} — showing all available services
                </div>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {results.map((tr) => (
                <div key={tr.id} className="flex flex-col gap-2">
                  <TrainCard train={tr} />
                  <button
                    onClick={() => handleOpenPayment(tr)}
                    className="flex items-center justify-center gap-2 rounded-sm border border-primary bg-primary/10 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/20"
                  >
                    <Ticket className="h-4 w-4" /> {t("generateTicket")}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Passenger Details Modal */}
      {passengerStep && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16">
          <div className="w-full max-w-md rounded-md border border-border bg-card p-6 shadow-elevated">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">Passenger Details</h3>
              <button onClick={() => setPassengerStep(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 space-y-1 rounded-sm bg-secondary/40 p-3 text-sm">
              <Row label="Route"   value={`${passengerStep.from} → ${passengerStep.to}`} />
              <Row label="Train"   value={`#${passengerStep.trainNo} · ${passengerStep.line}`} />
              <Row label="Departs" value={passengerStep.departure} />
              <Row label="Fare"    value={`R ${passengerStep.fare.toFixed(2)}`} />
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Full name <span className="text-destructive">*</span></label>
                <input
                  required
                  value={passengerForm.name}
                  onChange={(e) => setPassengerForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Thabo Nkosi"
                  className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">ID / Passport number</label>
                <input
                  value={passengerForm.idNumber}
                  onChange={(e) => setPassengerForm((f) => ({ ...f, idNumber: e.target.value }))}
                  placeholder="SA ID or passport number"
                  className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Email address</label>
                <input
                  type="email"
                  value={passengerForm.email}
                  onChange={(e) => setPassengerForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="you@example.com"
                  className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Phone number</label>
                <input
                  type="tel"
                  value={passengerForm.phone}
                  onChange={(e) => setPassengerForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="0821234567"
                  className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <p className="text-xs text-muted-foreground">Your details are used for ticket recovery and resending only.</p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setPassengerStep(null)}
                  className="flex-1 rounded-sm border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  disabled={!passengerForm.name.trim() || ticketLoading}
                  onClick={() => handleConfirmPassenger(passengerStep)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {ticketLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
                  {ticketLoading ? "Processing…" : "Continue"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {ticketModal && paymentClientSecret && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16">
          <div className="w-full max-w-md rounded-md border border-border bg-card p-6 shadow-elevated">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground">Pay for Ticket</h3>
              <button onClick={() => { setTicketModal(null); setPaymentClientSecret(null); }} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 space-y-1 rounded-sm bg-secondary/40 p-3 text-sm">
              <Row label={t("route")}   value={`${ticketModal.from} → ${ticketModal.to}`} />
              <Row label={t("train")}   value={`#${ticketModal.trainNo} · ${ticketModal.line}`} />
              <Row label={t("departs")} value={ticketModal.departure} />
              <Row label={t("fare")}    value={`R ${ticketModal.fare.toFixed(2)}`} />
              <p className="pt-1 text-xs text-muted-foreground">Ref: <span className="font-mono font-semibold text-primary">{paymentTicketRef}</span></p>
            </div>
            <Elements stripe={stripePromise} options={{ clientSecret: paymentClientSecret, appearance: { theme: "stripe" } }}>
              <StripePaymentForm
                ticketModal={ticketModal}
                onSuccess={(ticket) => {
                  setGeneratedTicket(ticket);
                  setTicketModal(null);
                  setPaymentClientSecret(null);
                }}
                onCancel={() => { setTicketModal(null); setPaymentClientSecret(null); }}
              />
            </Elements>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {generatedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-md border border-border bg-card p-6 text-center shadow-elevated">
            <CheckCircle className="mx-auto h-12 w-12 text-success" />
            <h3 className="mt-3 text-lg font-bold text-foreground">{t("ticketGenerated")}</h3>
            <p className="mt-1 text-2xl font-mono font-bold text-primary">{generatedTicket.ticket_ref}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Booked {new Date(generatedTicket.booked_at).toLocaleString("en-ZA")}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">{t("ticketSaved")}</p>
            <button
              onClick={() => setGeneratedTicket(null)}
              className="mt-4 w-full rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              {t("done")}
            </button>
          </div>
        </div>
      )}

      <Footer />
      <Chatbot />
    </div>
  );
}

function StripePaymentForm({
  ticketModal,
  onSuccess,
  onCancel,
}: {
  ticketModal: import("@/data/prasa").TrainSchedule;
  onSuccess: (ticket: { ticket_ref: string; booked_at: string }) => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [stripeError, setStripeError] = useState("");

  const handlePay = async () => {
    if (!stripe || !elements || !ready) return;
    setPaying(true);
    setStripeError("");
    try {
      const { error: submitErr } = await elements.submit();
      if (submitErr) { setStripeError(submitErr.message ?? "Validation failed"); return; }
      const { error, paymentIntent } = await stripe.confirmPayment({ elements, redirect: "if_required" });
      if (error) { setStripeError(error.message ?? "Payment failed"); return; }
      if (paymentIntent?.status === "succeeded") {
        const ticket = await api.confirmPayment(paymentIntent.id);
        onSuccess({ ticket_ref: ticket.ticket_ref, booked_at: ticket.booked_at });
      }
    } catch (e: any) {
      setStripeError(e.message ?? "Payment error");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="space-y-4">
      <PaymentElement onReady={() => setReady(true)} />
      {!ready && <p className="text-xs text-muted-foreground">Loading payment form…</p>}
      {stripeError && <p className="text-sm text-destructive">{stripeError}</p>}
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 rounded-sm border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-secondary">Cancel</button>
        <button
          onClick={handlePay}
          disabled={paying || !ready}
          className="flex flex-1 items-center justify-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
          {paying ? "Processing…" : `Pay R ${ticketModal.fare.toFixed(2)}`}
        </button>
      </div>
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

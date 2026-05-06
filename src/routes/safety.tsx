import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Chatbot } from "@/components/Chatbot";
import { STATIONS } from "@/data/prasa";
import { api } from "@/lib/api";
import { ShieldAlert, Phone, AlertTriangle, CheckCircle2, Siren, HeartPulse, Flame, Loader2 } from "lucide-react";

export const Route = createFileRoute("/safety")({
  head: () => ({
    meta: [
      { title: "Safety & SOS — PRASA Smart Commute" },
      { name: "description", content: "Emergency contacts, incident reporting and safety guidance for Metrorail commuters." },
    ],
  }),
  component: SafetyPage,
});

const INCIDENT_TYPES = [
  "Suspicious activity",
  "Theft / robbery",
  "Damage / vandalism",
  "Medical assistance",
  "Other",
] as const;

const TIPS = [
  "Avoid travelling with valuables on display — keep phones and laptops in a closed bag.",
  "Stay close to the station controller and well-lit areas while waiting.",
  "If you feel unsafe in a coach, move to a busier carriage at the next stop.",
  "Report any suspicious behaviour to a guard or via the SOS form below.",
];

function SafetyPage() {
  const [type, setType] = useState<string>(INCIDENT_TYPES[0]);
  const [station, setStation] = useState(STATIONS[0]);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!details.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await api.reportSafetyIncident({ type, station, details });
      setSent(true);
      setDetails("");
      setTimeout(() => setSent(false), 3500);
    } catch (err: any) {
      setError(err.message ?? "Failed to submit. Make sure the server is running.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <section className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-8">
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
            <ShieldAlert className="h-6 w-6 text-destructive" /> Safety & SOS
          </h1>
          <p className="mt-1 text-sm opacity-90">Emergency contacts, incident reporting and travel safety tips.</p>
        </div>
      </section>

      <section className="container mx-auto grid flex-1 gap-6 px-4 py-8 lg:grid-cols-3">
        {/* Quick contacts */}
        <div className="space-y-3 lg:col-span-1">
          <SOSCard icon={<Siren className="h-5 w-5" />} label="PRASA Protection Services" number="0800 65 64 63" tone="bg-destructive text-destructive-foreground" />
          <SOSCard icon={<Phone className="h-5 w-5" />} label="SAPS Emergency" number="10111" tone="bg-primary text-primary-foreground" />
          <SOSCard icon={<HeartPulse className="h-5 w-5" />} label="Medical Emergency" number="10177" tone="bg-success text-primary-foreground" />
          <SOSCard icon={<Flame className="h-5 w-5" />} label="Fire Brigade" number="107" tone="bg-warning text-foreground" />
        </div>

        {/* Report form */}
        <form onSubmit={submit} className="rounded-md border border-border bg-card p-5 shadow-card lg:col-span-2">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <AlertTriangle className="h-5 w-5 text-destructive" /> Report an incident
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            For life-threatening emergencies, call the numbers on the left. Use this form for non-urgent reports.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Type">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
              >
                {INCIDENT_TYPES.map((o) => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Station / location">
              <select
                value={station}
                onChange={(e) => setStation(e.target.value)}
                className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
              >
                {STATIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Details" className="mt-3">
            <textarea
              value={details}
              maxLength={500}
              required
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Describe what happened, time, train number if known…"
              className="min-h-[120px] w-full rounded-sm border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </Field>

          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{details.length}/500 characters</span>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-sm bg-destructive px-5 py-2.5 text-sm font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Sending…" : "Send report"}
            </button>
          </div>

          {sent && (
            <div className="mt-3 flex items-center gap-2 rounded-sm border border-success/40 bg-success/10 p-3 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" /> Report received and saved. A protection officer will follow up.
            </div>
          )}
          {error && (
            <p className="mt-3 rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
          )}

          <div className="mt-6 border-t border-border pt-4">
            <h3 className="mb-2 text-sm font-semibold text-foreground">Travel safely</h3>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {TIPS.map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </form>
      </section>

      <Footer />
      <Chatbot />
    </div>
  );
}

function SOSCard({ icon, label, number, tone }: { icon: React.ReactNode; label: string; number: string; tone: string }) {
  return (
    <a
      href={`tel:${number.replace(/\s/g, "")}`}
      className={`flex items-center justify-between rounded-md p-4 shadow-card transition-transform hover:scale-[1.01] ${tone}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">{icon}</div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest opacity-90">Tap to call</div>
          <div className="text-sm font-bold">{label}</div>
        </div>
      </div>
      <div className="text-lg font-bold">{number}</div>
    </a>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

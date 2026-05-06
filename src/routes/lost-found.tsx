import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Chatbot } from "@/components/Chatbot";
import { STATIONS } from "@/data/prasa";
import { api } from "@/lib/api";
import { Search, CheckCircle2, PackageSearch, Loader2 } from "lucide-react";

export const Route = createFileRoute("/lost-found")({
  head: () => ({
    meta: [
      { title: "Lost & Found — PRASA Smart Commute" },
      { name: "description", content: "Report a lost item or browse items found on Metrorail trains and stations." },
    ],
  }),
  component: LostFoundPage,
});

type Report = {
  id: string;
  item: string;
  station: string;
  date: string;
  contact_ref: string;
  status: "open" | "matched";
  created_at: string;
};

function LostFoundPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const [item, setItem] = useState("");
  const [station, setStation] = useState(STATIONS[0]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [contact, setContact] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    api.getLostFound()
      .then(setReports)
      .catch(() => setReports([]))
      .finally(() => setLoadingReports(false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item.trim() || !contact.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const newReport = await api.reportLostFound({ item, station, date, contact });
      setReports((prev) => [newReport, ...prev]);
      setSubmitted(true);
      setItem("");
      setContact("");
      setTimeout(() => setSubmitted(false), 3500);
    } catch (err: any) {
      setError(err.message ?? "Failed to submit. Make sure the server is running.");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = reports.filter(
    (r) => !query || r.item.toLowerCase().includes(query.toLowerCase()) || r.station.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <section className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-8">
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
            <PackageSearch className="h-6 w-6 text-destructive" /> Lost & found
          </h1>
          <p className="mt-1 text-sm opacity-90">Report something you've lost or check if it's been found.</p>
        </div>
      </section>

      <section className="container mx-auto grid flex-1 gap-6 px-4 py-8 lg:grid-cols-[1fr_1.4fr]">
        {/* Submit form */}
        <form onSubmit={submit} className="rounded-md border border-border bg-card p-5 shadow-card">
          <h2 className="text-base font-semibold text-foreground">Report a lost item</h2>
          <div className="mt-4 space-y-3">
            <Field label="Item description">
              <input
                value={item} maxLength={120} required
                onChange={(e) => setItem(e.target.value)}
                placeholder="e.g. Brown leather wallet"
                className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </Field>
            <Field label="Station">
              <select
                value={station}
                onChange={(e) => setStation(e.target.value)}
                className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
              >
                {STATIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Date">
              <input
                type="date" value={date} required
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </Field>
            <Field label="Contact (email or phone)">
              <input
                value={contact} maxLength={120} required
                onChange={(e) => setContact(e.target.value)}
                placeholder="Kept private — only a reference ID is shown publicly"
                className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </Field>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-sm bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Submitting…" : "Submit report"}
            </button>

            {submitted && (
              <div className="flex items-center gap-2 rounded-sm border border-success/40 bg-success/10 p-3 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" /> Report saved. Our team will be in touch.
              </div>
            )}
            {error && (
              <p className="rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
            )}
          </div>
        </form>

        {/* Reports list */}
        <div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search items or stations…"
              className="w-full rounded-sm border border-input bg-background py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>

          {loadingReports ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-md border border-border bg-card" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((r) => (
                <article key={r.id} className="rounded-md border border-border bg-card p-4 shadow-card">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-foreground">{r.item}</h3>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${
                        r.status === "matched"
                          ? "border-success/30 bg-success/15 text-success"
                          : "border-warning/40 bg-warning/20 text-foreground"
                      }`}
                    >
                      {r.status === "matched" ? "Matched" : "Open"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.station} · {new Date(r.date).toLocaleDateString("en-ZA")} · Ref {r.contact_ref}
                  </p>
                </article>
              ))}
              {filtered.length === 0 && (
                <p className="rounded-md border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
                  No matching reports.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      <Footer />
      <Chatbot />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

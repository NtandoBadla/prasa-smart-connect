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
  const [showReferenceModal, setShowReferenceModal] = useState(false);
  const [submittedReport, setSubmittedReport] = useState<Report | null>(null);

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
      setSubmittedReport(newReport);
      setShowReferenceModal(true);
      setItem("");
      setContact("");
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

            {error && (
              <p className="rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
            )}
          </div>
        </form>

        {/* Reference ID Modal */}
        {showReferenceModal && submittedReport && (
          <ReferenceModal
            report={submittedReport}
            onClose={() => {
              setShowReferenceModal(false);
              setSubmittedReport(null);
            }}
          />
        )}

       
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

function ReferenceModal({ report, onClose }: { report: Report; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(report.contact_ref);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/15">
            <CheckCircle2 className="h-6 w-6 text-success" />
          </div>
          
          <h2 className="mb-2 text-lg font-semibold text-foreground">Report Submitted Successfully!</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Your lost item report has been submitted. Please save your reference ID.
          </p>

          <div className="mb-6 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Your Reference ID</p>
            <div className="flex items-center justify-center gap-2">
              <code className="text-xl font-bold text-primary">{report.contact_ref}</code>
              <button
                onClick={copyToClipboard}
                className="rounded-sm border border-border p-1 hover:bg-secondary"
                title="Copy to clipboard"
              >
                {copied ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
            {copied && <p className="mt-1 text-xs text-success">Copied to clipboard!</p>}
          </div>

          <div className="mb-6 rounded-sm border border-warning/40 bg-warning/10 p-3 text-left">
            <h3 className="mb-2 text-sm font-semibold text-foreground">📝 Important Reminders:</h3>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>• <strong>Save this reference ID</strong> - you'll need it to claim your item</li>
              <li>• <strong>Take a screenshot</strong> or write it down safely</li>
              <li>• <strong>Check your email</strong> for confirmation and updates</li>
              <li>• <strong>Bring proof of ownership</strong> when collecting</li>
            </ul>
          </div>

          <div className="mb-4 text-left text-xs text-muted-foreground">
            <p><strong>Item:</strong> {report.item}</p>
            <p><strong>Station:</strong> {report.station}</p>
            <p><strong>Date:</strong> {new Date(report.date).toLocaleDateString("en-ZA")}</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={copyToClipboard}
              className="flex-1 rounded-sm border border-primary bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              {copied ? "Copied!" : "Copy Reference ID"}
            </button>
            <button
              onClick={onClose}
              className="flex-1 rounded-sm border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

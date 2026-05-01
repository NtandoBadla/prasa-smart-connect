import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { api } from "@/lib/api";
import { STATIONS } from "@/data/prasa";
import { Bell, CheckCircle, Mail, MapPin, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Register for Updates — PRASA Smart Commute" },
      { name: "description", content: "Register your email and station to receive instant train availability notifications." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const [form, setForm] = useState({ email: "", station: "" });
  const [extraStation, setExtraStation] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [userId, setUserId] = useState("");
  const [subLoading, setSubLoading] = useState(false);
  const [subMsg, setSubMsg] = useState("");

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      const res = await api.register(form.email, form.station);
      setUserId(res.userId);
      setStatus("success");
      setMessage(`Registered! You'll receive updates for ${form.station}.`);
    } catch (err) {
      setStatus("error");
      setMessage((err as Error).message);
    }
  }

  async function handleSubscribe() {
    if (!extraStation || !form.email) return;
    setSubLoading(true);
    setSubMsg("");
    try {
      const res = await api.subscribe(form.email, extraStation);
      setSubMsg(res.message);
      setExtraStation("");
    } catch (err) {
      setSubMsg((err as Error).message);
    } finally {
      setSubLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <section className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-8">
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
            <Bell className="h-6 w-6 text-destructive" /> Train update notifications
          </h1>
          <p className="mt-1 text-sm opacity-90">
            Register your email and home station to get instant alerts when train status changes.
          </p>
        </div>
      </section>

      <section className="container mx-auto flex-1 px-4 py-10">
        <div className="mx-auto max-w-lg space-y-6">

          {/* Registration form */}
          <div className="rounded-md border border-border bg-card p-6 shadow-card">
            <h2 className="mb-4 font-semibold text-foreground">Create your alert profile</h2>
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Mail className="h-4 w-4" /> Email address
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="you@example.com"
                  className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <MapPin className="h-4 w-4" /> Home station / area
                </label>
                <select
                  required
                  value={form.station}
                  onChange={(e) => setForm((f) => ({ ...f, station: e.target.value }))}
                  className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select a station…</option>
                  {STATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {message && (
                <div className={`flex items-start gap-2 rounded-sm p-3 text-sm ${status === "success" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                  {status === "success" && <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={status === "loading"}
                className="flex w-full items-center justify-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                <Bell className="h-4 w-4" />
                {status === "loading" ? "Registering…" : "Register for updates"}
              </button>
            </form>
          </div>

          {/* Add more stations after registration */}
          {(status === "success" || userId) && (
            <div className="rounded-md border border-border bg-card p-6 shadow-card">
              <h2 className="mb-3 font-semibold text-foreground">Subscribe to more stations</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Get notified for multiple stations — useful if you commute via connecting lines.
              </p>
              <div className="flex gap-2">
                <select
                  value={extraStation}
                  onChange={(e) => setExtraStation(e.target.value)}
                  className="flex-1 rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="">Select station…</option>
                  {STATIONS.filter((s) => s !== form.station).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  onClick={handleSubscribe}
                  disabled={!extraStation || subLoading}
                  className="flex items-center gap-1.5 rounded-sm bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  {subLoading ? "Adding…" : "Add"}
                </button>
              </div>
              {subMsg && (
                <p className="mt-2 text-sm text-success">{subMsg}</p>
              )}
            </div>
          )}

          {/* Info card */}
          <div className="rounded-md border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">What you'll receive:</p>
            <ul className="mt-2 space-y-1">
              <li>• Instant email when a train at your station is delayed or cancelled</li>
              <li>• The reason for the disruption (if known)</li>
              <li>• The time the update was posted</li>
              <li>• Alternative train suggestions</li>
            </ul>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

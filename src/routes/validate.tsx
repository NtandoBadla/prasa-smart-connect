import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CheckCircle2, XCircle, Clock, Loader2, Ticket, Train, ArrowRight } from "lucide-react";

const searchSchema = z.object({
  token: z.string().optional().default(""),
});

export const Route = createFileRoute("/validate")({
  head: () => ({
    meta: [{ title: "Ticket Validation — PRASA Smart Commute" }],
  }),
  validateSearch: searchSchema,
  component: ValidatePage,
});

type ValidResult = {
  valid: true;
  ticket_ref: string;
  from_station: string;
  to_station: string;
  departure: string;
  line: string;
};

type InvalidResult = {
  valid: false;
  reason: string;
  used_at?: string;
};

type ScanResult = ValidResult | InvalidResult;

function ValidatePage() {
  const { token } = Route.useSearch();
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualToken, setManualToken] = useState("");

  async function validate(qrToken: string) {
    if (!qrToken.trim()) return;
    setLoading(true);
    setResult(null);
    // Accept either a raw token or a full URL containing ?token=...
    let token = qrToken.trim();
    try {
      const url = new URL(token);
      const param = url.searchParams.get("token");
      if (param) token = param;
    } catch {
      // Not a URL — use as-is (raw token)
    }
    try {
      const BASE = (import.meta.env.PROD ? "" : (import.meta.env.VITE_API_URL ?? "")) + "/api";
      const res = await fetch(`${BASE}/tickets/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken: token }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ valid: true, ...data });
      } else {
        setResult({ valid: false, reason: data.reason ?? data.error ?? "Validation failed", used_at: data.used_at });
      }
    } catch {
      setResult({ valid: false, reason: "Could not reach the server. Check your connection." });
    } finally {
      setLoading(false);
    }
  }

  // Auto-validate when token comes in via URL query param (QR scan)
  useEffect(() => {
    if (token) validate(token);
  }, [token]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <section className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-8">
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
            <Ticket className="h-6 w-6 text-destructive" /> Ticket Validation
          </h1>
          <p className="mt-1 text-sm opacity-90">
            Station inspectors: scan a passenger's QR code or paste the token below.
          </p>
        </div>
      </section>

      <section className="container mx-auto flex-1 px-4 py-8 max-w-lg space-y-6">

        {/* Manual entry */}
        {!token && (
          <div className="rounded-md border border-border bg-card p-5 space-y-3">
            <p className="text-sm font-medium text-foreground">Paste QR token manually</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && validate(manualToken)}
                placeholder="64-character hex token from QR code"
                className="flex-1 rounded-sm border border-input bg-background px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
              <button
                onClick={() => validate(manualToken)}
                disabled={loading || !manualToken.trim()}
                className="flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Validate"}
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center gap-3 rounded-md border border-border bg-card p-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">Validating ticket…</p>
          </div>
        )}

        {/* Result */}
        {!loading && result && (
          result.valid ? (
            <div className="overflow-hidden rounded-xl border-2 border-success bg-card shadow-elevated">
              <div className="flex items-center gap-3 bg-success px-5 py-4 text-white">
                <CheckCircle2 className="h-8 w-8 flex-shrink-0" />
                <div>
                  <p className="text-lg font-bold">VALID TICKET</p>
                  <p className="text-sm opacity-90">Passenger may board</p>
                </div>
              </div>
              <div className="p-5 space-y-3">
                <div className="rounded-lg bg-success/10 px-4 py-2 text-center">
                  <p className="font-mono text-xl font-bold text-success">{result.ticket_ref}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md bg-secondary/50 p-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Route</p>
                    <p className="font-semibold flex items-center gap-1">
                      {result.from_station}
                      <ArrowRight className="h-3 w-3 flex-shrink-0" />
                      {result.to_station}
                    </p>
                  </div>
                  <div className="rounded-md bg-secondary/50 p-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Line</p>
                    <p className="font-semibold flex items-center gap-1">
                      <Train className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      {result.line}
                    </p>
                  </div>
                  <div className="rounded-md bg-secondary/50 p-3 col-span-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Departure time</p>
                    <p className="text-2xl font-bold text-foreground">{result.departure}</p>
                  </div>
                </div>
                <p className="text-center text-xs text-success font-semibold">
                  ✓ Ticket marked as used
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border-2 border-destructive bg-card shadow-elevated">
              <div className="flex items-center gap-3 bg-destructive px-5 py-4 text-white">
                {result.reason?.toLowerCase().includes("already used") ? (
                  <Clock className="h-8 w-8 flex-shrink-0" />
                ) : (
                  <XCircle className="h-8 w-8 flex-shrink-0" />
                )}
                <div>
                  <p className="text-lg font-bold">
                    {result.reason?.toLowerCase().includes("already used")
                      ? "ALREADY USED"
                      : result.reason?.toLowerCase().includes("not been paid")
                        ? "NOT PAID"
                        : "INVALID TICKET"}
                  </p>
                  <p className="text-sm opacity-90">Do not allow boarding</p>
                </div>
              </div>
              <div className="p-5 space-y-3">
                <p className="text-sm text-foreground font-medium">{result.reason}</p>
                {result.used_at && (
                  <div className="rounded-md bg-destructive/10 px-4 py-2 text-sm">
                    <span className="text-muted-foreground">First scanned: </span>
                    <span className="font-semibold text-foreground">
                      {new Date(result.used_at).toLocaleString("en-ZA")}
                    </span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  If you believe this is an error, ask the passenger to contact PRASA support with their booking reference.
                </p>
              </div>
            </div>
          )
        )}

        {/* No token state */}
        {!token && !result && !loading && (
          <div className="rounded-md border border-dashed border-border bg-card p-10 text-center">
            <Ticket className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold text-foreground">Scan a QR code to validate</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use a phone camera to scan a passenger's ticket QR code,
              or paste the token above.
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              Passengers can view their tickets on the{" "}
              <Link to="/tickets" className="text-primary underline hover:no-underline">My Tickets</Link> page.
            </p>
          </div>
        )}

        {/* Scan another */}
        {result && (
          <button
            onClick={() => { setResult(null); setManualToken(""); }}
            className="w-full rounded-sm border border-border py-2 text-sm font-semibold text-muted-foreground hover:bg-secondary"
          >
            Validate another ticket
          </button>
        )}
      </section>

      <Footer />
    </div>
  );
}

import { useState, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Chatbot } from "@/components/Chatbot";
import { api } from "@/lib/api";
import { downloadTicketPDF } from "@/lib/ticketPDF";
import { QRCodeSVG } from "qrcode.react";
import {
  Ticket, Search, Calendar, Train, Download,
  CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, X,
} from "lucide-react";

export const Route = createFileRoute("/tickets")({
  head: () => ({
    meta: [{ title: "My Tickets — PRASA Smart Commute" }],
  }),
  component: TicketsPage,
});

type TicketRecord = {
  id: string;
  ticket_ref: string;
  qr_token: string;
  train_no: string;
  line: string;
  from_station: string;
  to_station: string;
  departure: string;
  arrival: string;
  fare: number;
  travel_class: string;
  payment_status: string;
  used: boolean;
  used_at: string | null;
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

// QR value: encode just the raw token. The /validate page accepts it via
// manual paste or URL param. Encoding a URL would break in dev (localhost)
// and ties the QR to a specific domain — the raw token is portable.
function makeQrValue(qrToken: string): string {
  return qrToken;
}

// ── QR Ticket Modal ───────────────────────────────────────────────────────────
function TicketQRModal({ ticket, onClose }: { ticket: TicketRecord; onClose: () => void }) {
  const qrWrapperRef = useRef<HTMLDivElement | null>(null);

  function downloadQR() {
    const wrapper = qrWrapperRef.current;
    const svg = wrapper?.querySelector("svg");
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ticket.ticket_ref}-qr.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const isUsed = ticket.used;
  const isPaid = ticket.payment_status === "paid";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-12 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-elevated">
        {/* Header */}
        <div className="flex items-center justify-between rounded-t-xl bg-primary px-5 py-4 text-primary-foreground">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-75">PRASA Metrorail</p>
            <p className="font-mono text-lg font-bold">{ticket.ticket_ref}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-primary-foreground/20">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Status banner */}
        <div className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold ${
          isUsed
            ? "bg-muted text-muted-foreground"
            : isPaid
              ? "bg-success/10 text-success"
              : "bg-warning/10 text-warning"
        }`}>
          {isUsed
            ? <><XCircle className="h-4 w-4" /> Ticket used{ticket.used_at ? ` — ${new Date(ticket.used_at).toLocaleString("en-ZA")}` : ""}</>
            : isPaid
              ? <><CheckCircle2 className="h-4 w-4" /> Valid · present at gate</>
              : <><Clock className="h-4 w-4" /> Payment {ticket.payment_status}</>}
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center gap-3 px-5 py-6">
          <div
            ref={qrWrapperRef}
            className={`rounded-xl p-3 ${isUsed ? "opacity-30 grayscale" : "bg-white shadow-md"}`}
          >
            <QRCodeSVG
              value={makeQrValue(ticket.qr_token)}
              size={180}
              level="H"
              includeMargin={false}
              imageSettings={{
                src: "/Train Logo.png",
                height: 28,
                width: 28,
                excavate: true,
              }}
            />
          </div>
          {isUsed && (
            <div className="absolute flex h-[180px] w-[180px] items-center justify-center">
              <span className="rotate-[-30deg] rounded-md border-4 border-destructive/60 px-4 py-2 text-2xl font-black uppercase text-destructive/60">
                Used
              </span>
            </div>
          )}
          <p className="text-center text-xs text-muted-foreground">
            {isPaid && !isUsed
              ? "Show this QR code to the station inspector or gate scanner."
              : isUsed
                ? "This ticket has already been scanned and is no longer valid."
                : "This ticket is not yet paid and cannot be used for travel."}
          </p>
        </div>

        {/* Journey details */}
        <div className="mx-5 mb-4 divide-y divide-border rounded-lg border border-border text-sm">
          <Row label="Route" value={`${ticket.from_station} → ${ticket.to_station}`} />
          <Row label="Train" value={`#${ticket.train_no} · ${ticket.line}`} />
          <Row label="Departs" value={ticket.departure} />
          <Row label="Arrives" value={ticket.arrival} />
          <Row label="Class" value={ticket.travel_class} />
          <Row label="Fare" value={`R ${Number(ticket.fare).toFixed(2)}`} bold />
          <Row label="Booked" value={new Date(ticket.booked_at).toLocaleString("en-ZA")} />
        </div>

        {/* Actions */}
        <div className="flex gap-2 border-t border-border px-5 py-4">
          <button
            onClick={() => downloadTicket(ticket)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-sm border border-primary px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
          >
            <Download className="h-4 w-4" /> PDF
          </button>
          <button
            onClick={downloadQR}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-sm bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Download className="h-4 w-4" /> QR Code
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-right ${bold ? "font-bold text-foreground" : "font-medium text-foreground"}`}>{value}</span>
    </div>
  );
}

// ── Ticket Card ───────────────────────────────────────────────────────────────
function TicketCard({ t }: { t: TicketRecord }) {
  const [expanded, setExpanded] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const statusColor =
    t.payment_status === "paid"
      ? t.used
        ? "bg-muted text-muted-foreground"
        : "bg-success/15 text-success"
      : t.payment_status === "pending"
        ? "bg-warning/20 text-foreground"
        : "bg-destructive/15 text-destructive";

  return (
    <>
      <article className="rounded-md border border-border bg-card shadow-card overflow-hidden">
        {/* Top colour strip */}
        <div className="h-1.5 bg-primary" />

        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="font-mono text-lg font-bold text-primary">{t.ticket_ref}</span>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="rounded-sm bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{t.line}</span>
                <span className="text-xs text-muted-foreground">Train #{t.train_no}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor}`}>
                  {t.used ? "Used" : t.payment_status.charAt(0).toUpperCase() + t.payment_status.slice(1)}
                </span>
              </div>
            </div>
            {/* Mini QR preview */}
            <button
              onClick={() => setShowQR(true)}
              title="View QR code"
              className="group flex-shrink-0 rounded-lg border-2 border-dashed border-border p-1 transition-all hover:border-primary hover:shadow-md"
            >
              <QRCodeSVG
                value={makeQrValue(t.qr_token)}
                size={52}
                level="L"
                className={`rounded-sm ${t.used ? "opacity-40 grayscale" : ""}`}
              />
              <p className="mt-0.5 text-center text-[9px] text-muted-foreground group-hover:text-primary">Tap to view</p>
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2 text-base font-semibold text-foreground">
            <Train className="h-4 w-4 text-destructive flex-shrink-0" />
            {t.from_station} → {t.to_station}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-sm">
            <Stat label="Departs" value={t.departure} />
            <Stat label="Arrives" value={t.arrival} />
            <Stat label="Class" value={t.travel_class} />
            <Stat label="Fare" value={`R ${Number(t.fare).toFixed(2)}`} />
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {new Date(t.booked_at).toLocaleString("en-ZA")}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {expanded ? "Less" : "More"}
              </button>
              <button
                onClick={() => setShowQR(true)}
                className="flex items-center gap-1 rounded-sm bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90"
              >
                <Ticket className="h-3 w-3" /> View QR
              </button>
            </div>
          </div>

          {expanded && (
            <div className="mt-3 space-y-1 border-t border-border pt-3 text-xs">
              {t.used && t.used_at && (
                <p className="rounded-sm bg-muted px-3 py-1.5 text-muted-foreground">
                  ✓ Scanned at {new Date(t.used_at).toLocaleString("en-ZA")}
                </p>
              )}
              <p className="text-muted-foreground">Ticket ID: <span className="font-mono">{t.id}</span></p>
              <button
                onClick={() => downloadTicket(t)}
                className="mt-2 inline-flex items-center gap-1 rounded-sm border border-primary px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
              >
                <Download className="h-3 w-3" /> Download PDF
              </button>
            </div>
          )}
        </div>
      </article>

      {showQR && <TicketQRModal ticket={t} onClose={() => setShowQR(false)} />}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function TicketsPage() {
  const [mode, setMode] = useState<"userId" | "ref">("ref");
  const [input, setInput] = useState("");
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [singleTicket, setSingleTicket] = useState<TicketRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch() {
    const val = input.trim();
    if (!val) return;
    setLoading(true);
    setError("");
    setTickets([]);
    setSingleTicket(null);
    try {
      if (mode === "ref") {
        const t = await api.lookupTicketByRef(val) as TicketRecord;
        setSingleTicket(t);
      } else {
        const data = await api.ticketHistory(val) as TicketRecord[];
        setTickets(data);
        if (data.length === 0) setError("No tickets found for this user ID.");
      }
    } catch (e: any) {
      setError(e.message ?? "Ticket not found. Check your reference and try again.");
    } finally {
      setLoading(false);
    }
  }

  const displayTickets: TicketRecord[] = singleTicket ? [singleTicket] : tickets;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <section className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-8">
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
            <Ticket className="h-6 w-6 text-destructive" /> My Tickets
          </h1>
          <p className="mt-1 text-sm opacity-90">
            Look up your digital ticket by reference number or browse all tickets for a user account.
          </p>
        </div>
      </section>

      <section className="container mx-auto flex-1 px-4 py-8 space-y-6">
        {/* Mode toggle */}
        <div className="flex rounded-sm border border-border bg-card overflow-hidden w-fit">
          <button
            onClick={() => { setMode("ref"); setInput(""); setTickets([]); setSingleTicket(null); setError(""); }}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${mode === "ref" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
          >
            By Ticket Ref
          </button>
          <button
            onClick={() => { setMode("userId"); setInput(""); setTickets([]); setSingleTicket(null); setError(""); }}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${mode === "userId" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
          >
            By User ID
          </button>
        </div>

        {/* Search bar */}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder={mode === "ref" ? "e.g. TKT-M3X8K1-FF2A" : "Enter your User ID (UUID)"}
            className="flex-1 rounded-sm border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Search className="h-4 w-4" /> {loading ? "Looking up…" : "Search"}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-sm bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <XCircle className="h-4 w-4 flex-shrink-0" /> {error}
          </div>
        )}

        {displayTickets.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {displayTickets.map((t) => (
              <TicketCard key={t.id} t={t} />
            ))}
          </div>
        )}

        {!loading && displayTickets.length === 0 && !error && (
          <div className="rounded-md border border-dashed border-border bg-card p-10 text-center">
            <Ticket className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold text-foreground">Find your ticket</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter a ticket reference (e.g. <code className="rounded bg-secondary px-1">TKT-...</code>) above, or switch to User ID to browse all your tickets.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Tickets are generated from the{" "}
              <a href="/fares" className="font-semibold text-primary hover:underline">Fares & Tickets</a>{" "}
              or{" "}
              <a href="/planner" className="font-semibold text-primary hover:underline">Trip Planner</a>{" "}
              page.
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

import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Chatbot } from "@/components/Chatbot";
import { STATIONS, searchTrains } from "@/data/prasa";
import { TICKET_TYPES, CLASS_MULTIPLIER, calcFare, type TicketTypeId, type TravelClass } from "@/data/extras";
import { downloadTicketPDF } from "@/lib/ticketPDF";
import { Ticket, QrCode, Download } from "lucide-react";

export const Route = createFileRoute("/fares")({
  head: () => ({
    meta: [
      { title: "Fares & Tickets — PRASA Smart Commute" },
      { name: "description", content: "Calculate Metrorail fares for single, return, weekly and monthly tickets in Metro and MetroPlus class." },
      { property: "og:title", content: "Fares & Tickets — PRASA" },
      { property: "og:description", content: "Calculate Metrorail fares and generate a digital ticket." },
    ],
  }),
  component: FaresPage,
});

function FaresPage() {
  const [from, setFrom] = useState("Cape Town");
  const [to, setTo] = useState("Simon's Town");
  const [ticket, setTicket] = useState<TicketTypeId>("single");
  const [cls, setCls] = useState<TravelClass>("Metro");
  const [generated, setGenerated] = useState(false);

  const matchedTrain = useMemo(() => searchTrains(from, to)[0] ?? null, [from, to]);
  const baseFare = matchedTrain?.fare ?? 0;
  const total = baseFare ? calcFare(baseFare, ticket, cls) : 0;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <section className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-8">
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
            <Ticket className="h-6 w-6 text-destructive" /> Fares & tickets
          </h1>
          <p className="mt-1 text-sm opacity-90">Calculate your fare and generate a digital ticket.</p>
        </div>
      </section>

      <section className="container mx-auto grid flex-1 gap-6 px-4 py-8 lg:grid-cols-2">
        <div className="rounded-md border border-border bg-card p-5 shadow-card">
          <h2 className="text-base font-semibold text-foreground">Fare calculator</h2>
          <div className="mt-4 grid gap-3">
            <Field label="From">
              <select
                value={from}
                onChange={(e) => { setFrom(e.target.value); setGenerated(false); }}
                className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
              >
                {STATIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="To">
              <select
                value={to}
                onChange={(e) => { setTo(e.target.value); setGenerated(false); }}
                className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
              >
                {STATIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>

            <Field label="Ticket type">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TICKET_TYPES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setTicket(t.id); setGenerated(false); }}
                    className={`rounded-sm border px-3 py-2 text-sm font-semibold transition-colors ${
                      ticket === t.id
                        ? "border-destructive bg-destructive text-destructive-foreground"
                        : "border-border bg-background text-foreground hover:bg-secondary"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Class">
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(CLASS_MULTIPLIER) as TravelClass[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => { setCls(c); setGenerated(false); }}
                    className={`rounded-sm border px-3 py-2 text-sm font-semibold transition-colors ${
                      cls === c
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-secondary"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-md border border-border bg-card p-5 shadow-card">
            <h2 className="text-base font-semibold text-foreground">Your fare</h2>
            {baseFare ? (
              <>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total</div>
                    <div className="text-4xl font-bold text-foreground">R {total.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">{cls} · {TICKET_TYPES.find((t) => t.id === ticket)?.label}</div>
                  </div>
                  <button
                    onClick={() => setGenerated(true)}
                    className="inline-flex items-center gap-2 rounded-sm bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:opacity-90"
                  >
                    <QrCode className="h-4 w-4" /> Generate ticket
                  </button>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-4 text-sm">
                  <div><dt className="text-muted-foreground">Base fare</dt><dd className="font-semibold">R {baseFare.toFixed(2)}</dd></div>
                  <div><dt className="text-muted-foreground">Class loading</dt><dd className="font-semibold">×{CLASS_MULTIPLIER[cls]}</dd></div>
                </dl>
              </>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">No direct route between these stations. Try Cape Town as origin.</p>
            )}
          </div>

          {generated && baseFare > 0 && <ETicket from={from} to={to} cls={cls} ticket={ticket} total={total} train={matchedTrain} />}
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

function ETicket({ from, to, cls, ticket, total, train }: {
  from: string; to: string; cls: TravelClass; ticket: TicketTypeId; total: number;
  train: import("@/data/prasa").TrainSchedule | null;
}) {
  const ref = `MR${Date.now().toString().slice(-8)}`;
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    await downloadTicketPDF({
      ref,
      from,
      to,
      trainNo:    train?.trainNo,
      line:       train?.line,
      departure:  train?.departure,
      arrival:    train?.arrival,
      travelClass: cls,
      ticketType: TICKET_TYPES.find((t) => t.id === ticket)?.label,
      fare: total,
      bookedAt: new Date().toLocaleString("en-ZA"),
      validDate: new Date().toLocaleDateString("en-ZA"),
    });
    setDownloading(false);
  }

  return (
    <div className="overflow-hidden rounded-md border-2 border-dashed border-primary bg-card shadow-elevated">
      <div className="flex items-center justify-between bg-primary px-5 py-3 text-primary-foreground">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest opacity-80">Metrorail e-ticket</div>
          <div className="text-sm font-bold">PRASA</div>
        </div>
        <div className="text-right text-xs opacity-90">Ref · {ref}</div>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-4 p-5">
        <div className="space-y-2 text-sm">
          <Row label="From" value={from} />
          <Row label="To" value={to} />
          {train && <Row label="Train" value={`#${train.trainNo} · ${train.line}`} />}
          {train && <Row label="Departs" value={train.departure} />}
          {train && <Row label="Arrives" value={train.arrival} />}
          <Row label="Class" value={cls} />
          <Row label="Type" value={TICKET_TYPES.find((t) => t.id === ticket)?.label || ""} />
          <Row label="Total" value={`R ${total.toFixed(2)}`} bold />
          <Row label="Valid" value={new Date().toLocaleDateString("en-ZA")} />
        </div>
        <FakeQR seed={ref} />
      </div>
      <div className="flex items-center justify-between border-t border-border bg-secondary/40 px-5 py-3 text-xs text-muted-foreground">
        <span>Show this code at the gate.</span>
        <button
          disabled={downloading}
          onClick={handleDownload}
          className="inline-flex items-center gap-1 font-semibold text-primary hover:underline disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" /> {downloading ? "Generating…" : "Download PDF"}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={bold ? "text-base font-bold text-foreground" : "font-medium text-foreground"}>{value}</span>
    </div>
  );
}

// Deterministic faux-QR for the on-screen preview only
function FakeQR({ seed }: { seed: string }) {
  const size = 21;
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  const cells: boolean[] = [];
  for (let i = 0; i < size * size; i++) {
    s = (s * 1103515245 + 12345) >>> 0;
    cells.push((s & 0xff) > 128);
  }
  const isFinder = (r: number, c: number) => {
    const inBox = (br: number, bc: number) =>
      r >= br && r < br + 7 && c >= bc && c < bc + 7;
    return inBox(0, 0) || inBox(0, size - 7) || inBox(size - 7, 0);
  };
  const finderFill = (r: number, c: number) => {
    const at = (br: number, bc: number) => {
      const lr = r - br, lc = c - bc;
      if (lr === 0 || lr === 6 || lc === 0 || lc === 6) return true;
      if (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4) return true;
      return false;
    };
    if (r < 7 && c < 7) return at(0, 0);
    if (r < 7 && c >= size - 7) return at(0, size - 7);
    if (r >= size - 7 && c < 7) return at(size - 7, 0);
    return false;
  };
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-32 w-32 rounded-sm bg-white p-1">
      {Array.from({ length: size * size }).map((_, i) => {
        const r = Math.floor(i / size), c = i % size;
        const filled = isFinder(r, c) ? finderFill(r, c) : cells[i];
        return filled ? <rect key={i} x={c} y={r} width="1" height="1" fill="black" /> : null;
      })}
    </svg>
  );
}

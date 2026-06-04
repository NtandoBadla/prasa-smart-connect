import { useState } from "react";
import { Share2, Copy, CheckCircle, MapPin, Clock, Navigation } from "lucide-react";

interface Props {
  from: string;
  currentStop: string;
  to: string;
  etaMinutes: number;
  trainNo: string;
  line: string;
}

export function ShareJourney({ from, currentStop, to, etaMinutes, trainNo, line }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const arrival = new Date(Date.now() + etaMinutes * 60_000).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });

  const text =
    `🚆 I'm on PRASA Metrorail!\n` +
    `📍 Started: ${from}\n` +
    `🚉 Currently at: ${currentStop}\n` +
    `🏁 Heading to: ${to}\n` +
    `🕐 Expected arrival: ~${arrival} (${etaMinutes} min)\n` +
    `Train #${trainNo} · ${line}\n` +
    `Track my journey: https://prasa-smart-connect.netlify.app/tracking`;

  async function handleCopy() {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function handleShare() {
    if (navigator.share) {
      await navigator.share({ title: "My PRASA Journey", text }).catch(() => {});
    } else {
      handleCopy();
    }
  }

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-sm border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
      >
        <Share2 className="h-3.5 w-3.5" /> Share Journey
      </button>

      {open && (
        <div className="mt-2 rounded-md border border-border bg-card p-4 shadow-card text-sm space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Journey summary</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-3.5 w-3.5 text-primary" /><span>Started at <strong className="text-foreground">{from}</strong></span></div>
            <div className="flex items-center gap-2 text-muted-foreground"><Navigation className="h-3.5 w-3.5 text-warning" /><span>Currently at <strong className="text-foreground">{currentStop}</strong></span></div>
            <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-3.5 w-3.5 text-success" /><span>Expected arrival at <strong className="text-foreground">{to}</strong>: ~{arrival} ({etaMinutes} min)</span></div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleShare} className="flex items-center gap-1.5 rounded-sm bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90">
              <Share2 className="h-3.5 w-3.5" /> Share
            </button>
            <button onClick={handleCopy} className="flex items-center gap-1.5 rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary">
              {copied ? <CheckCircle className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy text"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

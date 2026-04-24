import { useState } from "react";
import { ArrowRightLeft, Search, MapPin, Clock } from "lucide-react";
import { STATIONS } from "@/data/prasa";

interface Props {
  initialFrom?: string;
  initialTo?: string;
  initialTime?: string;
  onSearch: (from: string, to: string, time: string) => void;
  compact?: boolean;
}

export function RouteSearchForm({ initialFrom = "", initialTo = "", initialTime = "", onSearch, compact }: Props) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [time, setTime] = useState(initialTime);

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!from || !to) return;
    onSearch(from, to, time);
  };

  return (
    <form
      onSubmit={submit}
      className={`grid gap-3 rounded-md border border-border bg-card p-4 shadow-card ${compact ? "" : "md:p-6"}`}
    >
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_auto] md:items-end">
        <Field label="From" icon={<MapPin className="h-4 w-4" />}>
          <input
            list="stations"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="e.g. Cape Town"
            className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            required
          />
        </Field>
        <button
          type="button"
          onClick={swap}
          className="hidden md:flex h-10 w-10 items-center justify-center self-end rounded-sm border border-input bg-background text-muted-foreground transition-colors hover:bg-secondary"
          aria-label="Swap"
        >
          <ArrowRightLeft className="h-4 w-4" />
        </button>
        <Field label="To" icon={<MapPin className="h-4 w-4" />}>
          <input
            list="stations"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="e.g. Simon's Town"
            className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            required
          />
        </Field>
        <Field label="From time" icon={<Clock className="h-4 w-4" />}>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        </Field>
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-sm bg-destructive px-5 text-sm font-semibold text-destructive-foreground transition-colors hover:opacity-90"
        >
          <Search className="h-4 w-4" />
          Search trains
        </button>
      </div>
      <datalist id="stations">
        {STATIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </form>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

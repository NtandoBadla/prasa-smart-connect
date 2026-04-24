import { Clock, MapPin, Star } from "lucide-react";
import type { TrainSchedule } from "@/data/prasa";
import { useSavedRoutes } from "@/hooks/useSavedRoutes";

const statusStyles: Record<TrainSchedule["status"], string> = {
  "On Time": "bg-success/15 text-success border-success/30",
  Delayed: "bg-warning/20 text-foreground border-warning/40",
  Cancelled: "bg-destructive/15 text-destructive border-destructive/30",
};

export function TrainCard({ train, showSave = true }: { train: TrainSchedule; showSave?: boolean }) {
  const { isSaved, toggle } = useSavedRoutes();
  const saved = isSaved(train.from, train.to);
  return (
    <article className="rounded-md border border-border bg-card p-4 shadow-card transition-shadow hover:shadow-elevated">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-sm bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
              {train.line}
            </span>
            <span className="text-xs text-muted-foreground">Train #{train.trainNo}</span>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusStyles[train.status]}`}>
              {train.status}
              {train.delayMin ? ` · +${train.delayMin}m` : ""}
            </span>
          </div>
          <h3 className="mt-2 flex items-center gap-2 text-base font-semibold text-foreground">
            <MapPin className="h-4 w-4 text-destructive" />
            {train.from} <span className="text-muted-foreground">→</span> {train.to}
          </h3>
        </div>
        {showSave && (
          <button
            onClick={() => toggle(train.from, train.to)}
            className={`rounded-sm border p-2 transition-colors ${
              saved ? "border-destructive bg-destructive/10 text-destructive" : "border-border text-muted-foreground hover:bg-secondary"
            }`}
            aria-label="Save route"
            title={saved ? "Saved" : "Save route"}
          >
            <Star className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
          </button>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 border-t border-border pt-3 text-sm">
        <Stat label="Departs" value={train.departure} />
        <Stat label="Arrives" value={train.arrival} />
        <Stat label="Duration" value={`${train.durationMin} min`} icon={<Clock className="h-3 w-3" />} />
        <Stat label="Platform" value={train.platform} />
        <Stat label="Stops" value={`${train.stops.length}`} />
        <Stat label="Fare" value={`R ${train.fare.toFixed(2)}`} />
      </div>
    </article>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-center gap-1 font-semibold text-foreground">
        {icon}
        {value}
      </div>
    </div>
  );
}

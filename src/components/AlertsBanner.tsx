import { AlertTriangle, Info, AlertCircle } from "lucide-react";
import { ALERTS } from "@/data/prasa";

const icons = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const styles = {
  critical: "bg-destructive text-destructive-foreground",
  warning: "bg-warning text-foreground",
  info: "bg-secondary text-secondary-foreground",
};

export function AlertsBanner() {
  const top = ALERTS[0];
  const Icon = icons[top.level];
  return (
    <div className={`${styles[top.level]} border-b border-border`}>
      <div className="container mx-auto flex items-start gap-3 px-4 py-2.5 text-sm">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="flex-1">
          <span className="font-semibold">{top.title}.</span>{" "}
          <span className="opacity-95">{top.message}</span>
        </div>
      </div>
    </div>
  );
}

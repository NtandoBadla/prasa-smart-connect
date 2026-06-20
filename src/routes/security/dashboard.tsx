import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { LayoutDashboard, RefreshCw, CheckCircle2, XCircle, AlertTriangle, ScanLine } from "lucide-react";

export const Route = createFileRoute("/security/dashboard")({
  component: SecurityDashboard,
});

type Stats = Awaited<ReturnType<typeof api.securityDashboard>>;
type ScanRow = Awaited<ReturnType<typeof api.securityScanHistory>>[number];

const RESULT_STYLE: Record<string, { cls: string; label: string }> = {
  valid:       { cls: "text-green-600 bg-green-50",   label: "Valid"       },
  expired:     { cls: "text-red-600 bg-red-50",       label: "Expired"     },
  blacklisted: { cls: "text-red-700 bg-red-100",      label: "Blacklisted" },
  used:        { cls: "text-orange-600 bg-orange-50", label: "Used"        },
  no_rides:    { cls: "text-orange-700 bg-orange-100",label: "No Rides"    },
  not_found:   { cls: "text-muted-foreground bg-muted",label: "Not Found"  },
  unpaid:      { cls: "text-yellow-700 bg-yellow-50", label: "Unpaid"      },
};

export default function SecurityDashboard() {
  const [stats, setStats]     = useState<Stats | null>(null);
  const [history, setHistory] = useState<ScanRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [s, h] = await Promise.all([api.securityDashboard(), api.securityScanHistory()]);
      setStats(s);
      setHistory(h);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const statCards = stats
    ? [
        { label: "Total Scanned", value: stats.total,       icon: <ScanLine className="h-5 w-5 text-primary" /> },
        { label: "Valid",         value: stats.valid,       icon: <CheckCircle2 className="h-5 w-5 text-green-600" /> },
        { label: "Expired",       value: stats.expired,     icon: <XCircle className="h-5 w-5 text-red-500" /> },
        { label: "Blacklisted",   value: stats.blacklisted, icon: <AlertTriangle className="h-5 w-5 text-red-700" /> },
        { label: "Already Used",  value: stats.used,        icon: <XCircle className="h-5 w-5 text-orange-500" /> },
        { label: "No Rides",      value: stats.no_rides,    icon: <XCircle className="h-5 w-5 text-orange-700" /> },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 text-primary" /> Dashboard
        </h1>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 text-sm hover:bg-secondary disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <p className="text-sm text-muted-foreground">Today's scan totals — resets at midnight.</p>

      {loading && !stats ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {statCards.map((c) => (
              <div key={c.label} className="rounded-lg border border-border bg-card p-4 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {c.icon}
                  {c.label}
                </div>
                <span className="text-3xl font-bold text-foreground">{c.value}</span>
              </div>
            ))}
          </div>

          <div>
            <h2 className="mb-3 text-base font-semibold text-foreground">Recent Scans</h2>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No scans recorded yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Time</th>
                      <th className="px-3 py-2 text-left font-medium">Station</th>
                      <th className="px-3 py-2 text-left font-medium">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {history.slice(0, 50).map((row) => {
                      const style = RESULT_STYLE[row.validation_result] ?? { cls: "", label: row.validation_result };
                      return (
                        <tr key={row.id} className="bg-card">
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                            {new Date(row.scan_time).toLocaleTimeString("en-ZA")}
                          </td>
                          <td className="px-3 py-2 text-foreground">{row.station_name ?? "—"}</td>
                          <td className="px-3 py-2">
                            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${style.cls}`}>
                              {style.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

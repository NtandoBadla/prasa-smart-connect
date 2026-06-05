import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Chatbot } from "@/components/Chatbot";
import { api } from "@/lib/api";
import { STATIONS } from "@/data/prasa";
import { ShieldAlert, ShieldCheck, ShieldX, MapPin, RefreshCw, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/crime-map")({
  head: () => ({
    meta: [
      { title: "Crime Hotspots — PRASA Smart Connect" },
      { name: "description", content: "Crime hotspot risk levels per station from coach feedback sentiment and safety incident reports." },
    ],
  }),
  component: CrimeMapPage,
});

type RiskLevel = "High Risk" | "Moderate" | "Safe";
const RISK_ORDER: RiskLevel[] = ["High Risk", "Moderate", "Safe"];

interface StationRisk {
  station: string;
  risk: RiskLevel;
  feedbackCount: number;
  avgVaderCompound: number;
  negativePct: number;
  incidentCount: number;
  incidentTypes: Record<string, number>;
}

function calcRiskScore(s: StationRisk): number {
  const sentimentWeight = Math.max(0, (1 - s.avgVaderCompound) / 2);
  const negPctWeight    = s.negativePct / 100;
  const incidentWeight  = Math.min(1, s.incidentCount / 5);
  return sentimentWeight * 0.4 + negPctWeight * 0.3 + incidentWeight * 0.3;
}

function riskLevel(score: number, incidentCount: number): RiskLevel {
  if (score >= 0.55 || incidentCount >= 3) return "High Risk";
  if (score >= 0.35 || incidentCount >= 1) return "Moderate";
  return "Safe";
}

function CrimeMapPage() {
  const [stationRisks, setStationRisks] = useState<StationRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<RiskLevel | "All">("All");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const { feedback, incidents } = await api.hotspotData();

      // ── Build per-station sentiment aggregates from coach feedback ──────────
      // A feedback row belongs to BOTH from_station and to_station
      type FeedbackAgg = { compounds: number[]; negCount: number; total: number };
      const sentMap: Record<string, FeedbackAgg> = {};

      const touch = (st: string) => {
        if (!sentMap[st]) sentMap[st] = { compounds: [], negCount: 0, total: 0 };
      };

      feedback.forEach((f) => {
        // Each row is already expanded to a single station (from_station === to_station)
        const st = f.from_station;
        if (!st) return;
        touch(st);
        sentMap[st].compounds.push(f.vader_compound);
        sentMap[st].total += 1;
        const hfIsNeg = f.hf_label === "negative" && f.hf_confidence > 0.5;
        const vaderIsNeg = f.vader_compound < -0.05;
        if (hfIsNeg || vaderIsNeg) sentMap[st].negCount += 1;
      });

      // ── Build per-station incident aggregates ───────────────────────────────
      const incMap: Record<string, { count: number; types: Record<string, number> }> = {};
      incidents.forEach((i) => {
        if (!incMap[i.station]) incMap[i.station] = { count: 0, types: {} };
        incMap[i.station].count += 1;
        incMap[i.station].types[i.type] = (incMap[i.station].types[i.type] ?? 0) + 1;
      });

      // ── Build StationRisk for every known station ───────────────────────────
      const risks: StationRisk[] = STATIONS.map((station) => {
        const sa = sentMap[station];
        const ia = incMap[station];

        const feedbackCount    = sa?.total ?? 0;
        const avgVaderCompound = sa && sa.compounds.length > 0
          ? sa.compounds.reduce((a, b) => a + b, 0) / sa.compounds.length
          : 0.1; // slight positive default when no data
        const negativePct = feedbackCount > 0
          ? (sa.negCount / feedbackCount) * 100
          : 0;
        const incidentCount = ia?.count ?? 0;
        const incidentTypes  = ia?.types ?? {};

        const score = calcRiskScore({ station, risk: "Safe", feedbackCount, avgVaderCompound, negativePct, incidentCount, incidentTypes });
        const risk  = riskLevel(score, incidentCount);

        return { station, risk, feedbackCount, avgVaderCompound, negativePct, incidentCount, incidentTypes };
      });

      // Sort: high risk first, then moderate, then safe; within each group by score desc
      risks.sort((a, b) => {
        const oa = RISK_ORDER.indexOf(a.risk);
        const ob = RISK_ORDER.indexOf(b.risk);
        if (oa !== ob) return oa - ob;
        return calcRiskScore(b) - calcRiskScore(a);
      });

      setStationRisks(risks);
    } catch (e: any) {
      setError(e.message ?? "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  const displayed = stationRisks.filter((r) => filter === "All" || r.risk === filter);
  const counts = {
    "High Risk": stationRisks.filter((r) => r.risk === "High Risk").length,
    "Moderate":  stationRisks.filter((r) => r.risk === "Moderate").length,
    "Safe":      stationRisks.filter((r) => r.risk === "Safe").length,
  };
  const totalFeedback  = stationRisks.reduce((s, r) => s + r.feedbackCount, 0);
  const totalIncidents = stationRisks.reduce((s, r) => s + r.incidentCount, 0);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <section className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-8">
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
            <ShieldAlert className="h-6 w-6 text-destructive" /> Crime Hotspot Detection
          </h1>
          <p className="mt-1 text-sm opacity-90">
            Risk derived from {totalFeedback} coach feedback submission{totalFeedback !== 1 ? "s" : ""} and {totalIncidents} safety incident report{totalIncidents !== 1 ? "s" : ""}.
          </p>
        </div>
      </section>

      <section className="container mx-auto flex-1 px-4 py-8 space-y-6">

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            {error} — showing default safe values. Make sure the backend is running.
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <SummaryCard label="High Risk" count={counts["High Risk"]} color="destructive" icon={<ShieldX className="h-5 w-5" />} />
          <SummaryCard label="Moderate"  count={counts["Moderate"]}  color="warning"     icon={<ShieldAlert className="h-5 w-5" />} />
          <SummaryCard label="Safe"      count={counts["Safe"]}      color="success"     icon={<ShieldCheck className="h-5 w-5" />} />
        </div>

        {/* Filter + refresh */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filter:</span>
          {(["All", ...RISK_ORDER] as const).map((r) => (
            <button
              key={r}
              onClick={() => setFilter(r)}
              className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${
                filter === r
                  ? r === "All"       ? "bg-primary text-primary-foreground border-primary"
                  : r === "High Risk" ? "bg-destructive text-white border-destructive"
                  : r === "Moderate"  ? "bg-warning text-foreground border-warning"
                                      : "bg-success text-white border-success"
                  : "border-border bg-card text-foreground hover:bg-secondary"
              }`}
            >
              {r}
            </button>
          ))}
          <button onClick={loadData} className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        {/* Station grid */}
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-md border border-border bg-card" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {displayed.map((r) => <StationRiskCard key={r.station} data={r} />)}
          </div>
        )}

        {/* Legend / methodology */}
        <div className="rounded-md border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">How risk is calculated</p>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-destructive" />
              <span><strong className="text-foreground">High Risk (score ≥ 0.55 or 3+ incidents):</strong> High proportion of negative coach feedback (VADER + Hugging Face) and/or multiple safety incident reports.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-warning" />
              <span><strong className="text-foreground">Moderate (score ≥ 0.35 or 1–2 incidents):</strong> Mixed sentiment signals or at least one reported safety incident.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-success" />
              <span><strong className="text-foreground">Safe (score &lt; 0.35, no incidents):</strong> Predominantly positive passenger sentiment and no reported safety incidents.</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Risk score = 40% VADER sentiment + 30% negative feedback % + 30% incident rate. Both the departure and arrival station of each coach feedback submission are counted. Sentiment is cross-validated between VADER and Hugging Face (confidence &gt; 50%).
          </p>
        </div>
      </section>

      <Footer />
      <Chatbot />
    </div>
  );
}

function SummaryCard({ label, count, color, icon }: { label: string; count: number; color: string; icon: React.ReactNode }) {
  const cls =
    color === "destructive" ? "bg-destructive/10 border-destructive/30 text-destructive"
    : color === "warning"   ? "bg-warning/10 border-warning/30 text-warning"
                            : "bg-success/10 border-success/30 text-success";
  return (
    <div className={`rounded-md border p-4 ${cls}`}>
      <div className="flex items-center gap-2">{icon}<span className="text-xs font-semibold uppercase tracking-wider">{label}</span></div>
      <p className="mt-2 text-3xl font-bold">{count}</p>
      <p className="text-xs opacity-80">station{count !== 1 ? "s" : ""}</p>
    </div>
  );
}

function StationRiskCard({ data }: { data: StationRisk }) {
  const { risk, station, feedbackCount, avgVaderCompound, negativePct, incidentCount, incidentTypes } = data;

  const styles: Record<RiskLevel, { border: string; badge: string; bar: string; Icon: any }> = {
    "High Risk": { border: "border-destructive/40 bg-destructive/5", badge: "bg-destructive text-white",       bar: "bg-destructive",   Icon: ShieldX     },
    "Moderate":  { border: "border-warning/40 bg-warning/5",         badge: "bg-warning text-foreground",      bar: "bg-warning",       Icon: ShieldAlert  },
    "Safe":      { border: "border-success/30 bg-success/5",         badge: "bg-success text-white",           bar: "bg-success",       Icon: ShieldCheck  },
  };
  const s = styles[risk];
  const { Icon } = s;

  // bar width = risk score mapped to 0–100%
  const score = calcRiskScore(data);
  const barWidth = Math.round(score * 100);

  const topIncident = Object.entries(incidentTypes).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className={`rounded-md border p-4 ${s.border}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-semibold text-foreground text-sm">{station}</span>
        </div>
        <span className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${s.badge}`}>
          <Icon className="h-3 w-3" /> {risk}
        </span>
      </div>

      {/* Risk score bar */}
      <div className="mt-3 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full ${s.bar} transition-all`} style={{ width: `${barWidth}%` }} />
      </div>

      {/* Stats row */}
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>Feedback: <strong className="text-foreground">{feedbackCount}</strong></span>
        <span>Incidents: <strong className="text-foreground">{incidentCount}</strong></span>
        <span>Neg. feedback: <strong className="text-foreground">{negativePct.toFixed(0)}%</strong></span>
        <span>VADER avg: <strong className="text-foreground">{avgVaderCompound >= 0 ? "+" : ""}{avgVaderCompound.toFixed(2)}</strong></span>
      </div>

      {/* Top incident type */}
      {topIncident && (
        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <AlertTriangle className="h-3 w-3 shrink-0 text-warning" />
          <span>Most reported: <strong className="text-foreground">{topIncident[0]}</strong> ({topIncident[1]}×)</span>
        </div>
      )}
    </div>
  );
}

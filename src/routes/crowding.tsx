import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Chatbot } from "@/components/Chatbot";
import { SCHEDULES } from "@/data/prasa";
import { getCrowding, bestCoach } from "@/data/extras";
import { api } from "@/lib/api";
import { Users, Sparkles, Clock, MessageSquare, ShieldCheck, BarChart2, Loader2 } from "lucide-react";
import { RadialBarChart, RadialBar, ResponsiveContainer, Tooltip } from "recharts";

export const Route = createFileRoute("/crowding")({
  component: CrowdingPage,
});

function now24h() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function isPeak(time: string) {
  const [h] = time.split(":").map(Number);
  const dow = new Date().getDay();
  if (dow === 0 || dow === 6) return false;
  return (h >= 6 && h < 9) || (h >= 16 && h < 19);
}

const SAMPLE_REVIEWS = [
  "The train was very crowded during peak hours, barely any space to stand",
  "Security guards were present and I felt safe on the Southern Line",
  "Delayed again, packed like sardines, terrible experience",
  "Clean coaches today, on time and comfortable journey",
  "Crime is a concern at some stations, need more police patrols",
  "Smooth ride, friendly staff, good service overall",
];

type SentimentResult = {
  crowdLevel: "Low" | "Medium" | "High";
  safetyRating: "Safe" | "Moderate" | "Risky";
  sentimentScore: number;
  compound: number;
  crowdScore: number;
  huggingFace: { label: string; score: number } | null;
  analyzedCount: number;
};

function CrowdingPage() {
  const [trainId, setTrainId] = useState(SCHEDULES[0].id);
  const [time, setTime] = useState(now24h);
  const [feedbackText, setFeedbackText] = useState(SAMPLE_REVIEWS.join("\n"));
  const [sentiment, setSentiment] = useState<SentimentResult | null>(null);
  const [sentimentLoading, setSentimentLoading] = useState(false);
  const [sentimentError, setSentimentError] = useState("");

  const train = SCHEDULES.find((s) => s.id === trainId)!;
  const loads = useMemo(() => getCrowding(train.trainNo, 8, train.line, time), [train.trainNo, train.line, time]);
  const best = bestCoach(loads);
  const peak = isPeak(time);

  const runSentiment = async () => {
    const texts = feedbackText.split("\n").map((t) => t.trim()).filter(Boolean);
    if (texts.length === 0) return;
    setSentimentLoading(true);
    setSentimentError("");
    try {
      const result = await api.analyzeSentiment(texts);
      setSentiment(result);
    } catch {
      setSentimentError("Could not reach the analysis server. Make sure `npm run server` is running.");
    } finally {
      setSentimentLoading(false);
    }
  };

  const crowdColor = sentiment?.crowdLevel === "High" ? "text-destructive" : sentiment?.crowdLevel === "Medium" ? "text-warning" : "text-success";
  const safeColor = sentiment?.safetyRating === "Safe" ? "text-success" : sentiment?.safetyRating === "Moderate" ? "text-warning" : "text-destructive";
  const crowdBg = sentiment?.crowdLevel === "High" ? "bg-destructive/15 border-destructive/30" : sentiment?.crowdLevel === "Medium" ? "bg-warning/15 border-warning/30" : "bg-success/15 border-success/30";
  const safeBg = sentiment?.safetyRating === "Safe" ? "bg-success/15 border-success/30" : sentiment?.safetyRating === "Moderate" ? "bg-warning/15 border-warning/30" : "bg-destructive/15 border-destructive/30";

  const chartData = sentiment
    ? [{ name: "Sentiment", value: sentiment.sentimentScore, fill: sentiment.sentimentScore > 60 ? "#3a9e5f" : sentiment.sentimentScore > 40 ? "#e6a817" : "#d9534f" }]
    : [];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <section className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-8">
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
            <Users className="h-6 w-6 text-destructive" /> Crowding & Sentiment Analysis
          </h1>
          <p className="mt-1 text-sm opacity-90">
            AI-powered crowd prediction and safety analysis from passenger feedback.
          </p>
        </div>
      </section>

      <section className="container mx-auto flex-1 px-4 py-8 space-y-6">

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Train</label>
            <select
              value={trainId}
              onChange={(e) => setTrainId(e.target.value)}
              className="rounded-sm border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
            >
              {SCHEDULES.map((s) => (
                <option key={s.id} value={s.id}>
                  #{s.trainNo} · {s.from} → {s.to} · {s.departure}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Travel time
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="rounded-sm border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div className={`mt-4 self-end rounded-full px-3 py-1 text-xs font-semibold ${peak ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"}`}>
            {peak ? "⚡ Peak hour" : "✓ Off-peak"}
          </div>
        </div>

        {/* AI Recommendation */}
        <div className="rounded-md border border-l-4 border-l-success border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-2 text-success">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">AI recommendation</span>
          </div>
          <h2 className="mt-1 text-lg font-bold text-foreground">
            Board <span className="text-success">Coach {best.coach}</span> — {best.level} occupancy ({best.load}% full)
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {train.line} · {peak
              ? "Peak hour: front coaches fill first at Cape Town. Move towards the rear for more space."
              : "Off-peak: most coaches have comfortable space available."}
          </p>
        </div>

        {/* Coach layout */}
        <div className="rounded-md border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Train layout — #{train.trainNo} ({train.line})</h3>
            <span className="text-xs text-muted-foreground">← Front (Cape Town end) · Rear →</span>
          </div>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
            {loads.map((c) => {
              const tone = c.level === "Low" ? "bg-success" : c.level === "Moderate" ? "bg-warning" : c.level === "High" ? "bg-destructive/80" : "bg-destructive";
              const isBest = c.coach === best.coach;
              return (
                <div
                  key={c.coach}
                  className={`relative overflow-hidden rounded-md border-2 p-3 text-center text-primary-foreground ${tone} ${isBest ? "border-foreground ring-2 ring-success" : "border-transparent"}`}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wider opacity-90">Coach</div>
                  <div className="text-2xl font-bold">{c.coach}</div>
                  <div className="text-[11px] opacity-95">{c.load}%</div>
                  {isBest && <div className="mt-1 text-[9px] font-bold uppercase tracking-widest">Best</div>}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <Legend color="bg-success" label="Low (<40%)" />
            <Legend color="bg-warning" label="Moderate (40–65%)" />
            <Legend color="bg-destructive/80" label="High (65–85%)" />
            <Legend color="bg-destructive" label="Full (>85%)" />
          </div>
        </div>

        {/* ── Sentiment Analysis Section ── */}
        <div className="rounded-md border border-border bg-card p-5 shadow-card space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">Passenger Sentiment Analysis</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Paste passenger reviews or feedback below. The AI will analyze crowd levels and safety ratings using VADER + Hugging Face.
          </p>

          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            rows={6}
            placeholder="Enter one review per line…"
            className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none"
          />

          <button
            onClick={runSentiment}
            disabled={sentimentLoading}
            className="flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {sentimentLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart2 className="h-4 w-4" />}
            {sentimentLoading ? "Analyzing…" : "Analyze Sentiment"}
          </button>

          {sentimentError && (
            <p className="text-sm text-destructive">{sentimentError}</p>
          )}

          {sentiment && (
            <div className="space-y-4 pt-2">
              {/* Badges */}
              <div className="flex flex-wrap gap-3">
                <div className={`flex items-center gap-2 rounded-md border px-4 py-3 ${crowdBg}`}>
                  <Users className={`h-5 w-5 ${crowdColor}`} />
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Crowd Level</div>
                    <div className={`text-lg font-bold ${crowdColor}`}>{sentiment.crowdLevel}</div>
                  </div>
                </div>
                <div className={`flex items-center gap-2 rounded-md border px-4 py-3 ${safeBg}`}>
                  <ShieldCheck className={`h-5 w-5 ${safeColor}`} />
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Safety Rating</div>
                    <div className={`text-lg font-bold ${safeColor}`}>{sentiment.safetyRating}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-4 py-3">
                  <BarChart2 className="h-5 w-5 text-primary" />
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sentiment Score</div>
                    <div className="text-lg font-bold text-foreground">{sentiment.sentimentScore}/100</div>
                  </div>
                </div>
                {sentiment.huggingFace && (
                  <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-4 py-3">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">HuggingFace</div>
                      <div className="text-sm font-bold text-foreground">
                        {sentiment.huggingFace.label} ({(sentiment.huggingFace.score * 100).toFixed(0)}%)
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Radial chart */}
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="60%"
                    outerRadius="90%"
                    data={chartData}
                    startAngle={90}
                    endAngle={90 - (sentiment.sentimentScore / 100) * 360}
                  >
                    <RadialBar dataKey="value" cornerRadius={8} background={{ fill: "hsl(var(--secondary))" }} />
                    <Tooltip formatter={(v) => [`${v}/100`, "Sentiment"]} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <p className="text-center text-xs text-muted-foreground -mt-4">
                  Overall sentiment from {sentiment.analyzedCount} review{sentiment.analyzedCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          )}
        </div>

      </section>

      <Footer />
      <Chatbot />
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded-sm ${color}`} />
      {label}
    </span>
  );
}

import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Chatbot } from '@/components/Chatbot';
import { SCHEDULES } from '@/data/prasa';
import { getCrowding, bestCoach } from '@/data/extras';
import { Users, Sparkles, Clock } from 'lucide-react';
import { analyzeWithVader } from "@/lib/vader";


export const Route = createFileRoute('/crowding')({
  component: CrowdingPage,
});

function now24h() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function isPeak(time: string) {
  const [h] = time.split(':').map(Number);
  const dow = new Date().getDay();
  if (dow === 0 || dow === 6) return false;
  return (h >= 6 && h < 9) || (h >= 16 && h < 19);
}

function CrowdingPage() {
  const [trainId, setTrainId] = useState(SCHEDULES[0].id);
  const [time, setTime] = useState(now24h);
  const [feedback, setFeedback] = useState('');
  const [selectedCoach, setSelectedCoach] = useState(1);
const [resultsByContext, setResultsByContext] = useState<
  Record<string, any[]>
>({});
  const train = SCHEDULES.find((s) => s.id === trainId)!;
  const contextKey = `${trainId}-${time}`;

  const loads = useMemo(
    () => getCrowding(train.trainNo, 8, train.line, time),
    [train.trainNo, train.line, time]
  );

 const currentResults = resultsByContext[contextKey] || [];

const coachSentiment = useMemo(() => {
  const map: any = {};

  currentResults.forEach((r) => {
    map[r.coach] = r;
  });

  return map;
}, [currentResults]);

  const best = bestCoach(loads);
  const peak = isPeak(time);

  async function handleSubmit() {
  const text = feedback.trim();

  if (!text) {
    alert("Please enter feedback");
    return;
  }

  if (text.length > 5000) {
    alert("Text too long");
    return;
  }

  try {
    // ⚡ VADER (local)
    const vaderResult = analyzeWithVader(text);

    // 🤖 Hugging Face (via proxy)
    const token = import.meta.env.VITE_HF_API_TOKEN;

    const hfResp = await fetch(
      "/hf-api/j-hartmann/emotion-english-distilroberta-base",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: text,
          options: { wait_for_model: true },
        }),
      }
    );

    if (!hfResp.ok) {
      throw new Error(`HF error: ${hfResp.status}`);
    }

    const raw = await hfResp.json();

    const arr = Array.isArray(raw[0]) ? raw[0] : raw;

    const normalize = (l: string) => {
      const safe = ["joy", "surprise", "neutral"];
      const unsafe = ["anger", "disgust", "fear", "sadness"];
      if (safe.includes(l.toLowerCase())) return "positive";
      if (unsafe.includes(l.toLowerCase())) return "negative";
      return "neutral";
    };

    const scored = arr.map((r: any) => ({
      label: normalize(r.label),
      score: r.score,
    }));

    scored.sort((a: any, b: any) => b.score - a.score);

    const top = scored[0];

    // 🧠 Save result for this coach
    setResultsByContext((prev) => {
  const existing = prev[contextKey] || [];

  return {
    ...prev,
    [contextKey]: [
      ...existing,
      {
        coach: selectedCoach,
        hf: {
          label: top.label,
          confidence: top.score,
        },
        vader: {
          label: vaderResult.label,
          compound: vaderResult.compound,
        },
      },
    ],
  };
});

    setFeedback("");
  } catch (err) {
    console.error(err);
    alert("Analysis failed");
  }
}


  
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <section className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-8">
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
            <Users className="h-6 w-6 text-destructive" /> Crowding &amp; Best Coach
          </h1>
          <p className="mt-1 text-sm opacity-90">
            Skip the squeeze - see which coach is least busy before you board.
          </p>
        </div>
      </section>

      <section className="container mx-auto flex-1 px-4 py-8 space-y-6">
        {/* Safety Input */}
        <div className="rounded-md border border-border bg-card p-5 shadow-card space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Report Safety Experience</h3>
          <div className="flex flex-wrap gap-3">
            <select
              value={selectedCoach}
              onChange={(e) => setSelectedCoach(Number(e.target.value))}
              className="rounded-sm border px-3 py-2 text-sm"
            >
              {loads.map((c) => (
                <option key={c.coach} value={c.coach}>Coach {c.coach}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Describe how your experience was in the train..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="flex-1 rounded-sm border px-3 py-2 text-sm"
            />
            <button
              onClick={handleSubmit}
              className="rounded-sm bg-primary px-4 py-2 text-white text-sm"
            >
              Submit
            </button>
          </div>
        </div>

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
                  #{s.trainNo} - {s.from} to {s.to} - {s.departure}
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
          <div className={peak ? 'mt-4 self-end rounded-full px-3 py-1 text-xs font-semibold bg-destructive/15 text-destructive' : 'mt-4 self-end rounded-full px-3 py-1 text-xs font-semibold bg-success/15 text-success'}>
            {peak ? 'Peak hour' : 'Off-peak'}
          </div>
        </div>

        {/* AI Recommendation */}
        <div className="rounded-md border border-l-4 border-l-success border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-2 text-success">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">AI recommendation</span>
          </div>
          <h2 className="mt-1 text-lg font-bold text-foreground">
            Board <span className="text-success">Coach {best.coach}</span> - {best.level} occupancy ({best.load}% full)
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {train.line} - {peak ? 'Peak hour: front coaches fill first at Cape Town. Move towards the rear for more space.' : 'Off-peak: most coaches have comfortable space available.'}
          </p>
        </div>

        {/* Coach layout */}
        <div className="rounded-md border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Train layout - #{train.trainNo} ({train.line})</h3>
            <span className="text-xs text-muted-foreground">Front (Cape Town end) - Rear</span>
          </div>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
            {loads.map((c) => {
              const sentiment = coachSentiment[c.coach];
              const isBest = c.coach === best.coach;
              let tone = c.level === 'Low' ? 'bg-success' : c.level === 'Moderate' ? 'bg-warning' : c.level === 'High' ? 'bg-destructive/80' : 'bg-destructive';
              if (sentiment) {
                const isUnsafe = sentiment.vader.compound < 0 &&
                    sentiment.hf.label === "negative";
                    tone = isUnsafe ? "bg-destructive" : "bg-success";
                    }              
              return (
                <div
                  key={c.coach}
                  className={tone + ' relative overflow-hidden rounded-md border-2 p-3 text-center text-primary-foreground ' + (isBest ? 'border-foreground ring-2 ring-success' : 'border-transparent')}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wider opacity-90">Coach</div>
                  <div className="text-2xl font-bold">{c.coach}</div>
                  <div className="text-[11px] opacity-95">{c.load}%</div>
                  {sentiment && (
                    <div className="mt-2 text-[10px] bg-black/20 rounded p-1">
                     <div>
                        HF: {sentiment.hf.label} ({(sentiment.hf.confidence * 100).toFixed(0)}%)
                    </div>

                    <div>
                      VADER: {sentiment.vader.label} ({sentiment.vader.compound.toFixed(2)})
                    </div>
                    </div>
                  )}
                  {isBest && <div className="mt-1 text-[9px] font-bold uppercase tracking-widest">Best</div>}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <Legend color="bg-success" label="Low (<40%)" />
            <Legend color="bg-warning" label="Moderate (40-65%)" />
            <Legend color="bg-destructive/80" label="High (65-85%)" />
            <Legend color="bg-destructive" label="Full (>85%)" />
          </div>
        </div>

        {/* Tips */}
        <div className="rounded-md border border-border bg-card p-5 shadow-card">
          <h3 className="text-sm font-semibold text-foreground mb-3">Boarding tips for {train.line}</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Coaches 1-2 (front): Closest to the station exit at Cape Town - always most crowded</li>
            <li>Coaches 3-5 (middle): Moderate - good balance of space and exit access</li>
            <li>Coaches 6-8 (rear): Least crowded - best choice during peak hours</li>
            {peak && <li className="text-destructive">Peak hour: trains fill up fast - arrive 5 min early</li>}
          </ul>
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
      <span className={color + ' h-3 w-3 rounded-sm'} />
      {label}
    </span>
  );
}
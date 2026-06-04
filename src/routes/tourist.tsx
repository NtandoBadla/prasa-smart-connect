import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Chatbot } from "@/components/Chatbot";
import { STATIONS, SCHEDULES } from "@/data/prasa";
import { MapPin, Train, Footprints, Info, ArrowRight, Landmark } from "lucide-react";

export const Route = createFileRoute("/tourist")({
  head: () => ({
    meta: [
      { title: "Tourist Mode — PRASA Smart Connect" },
      { name: "description", content: "Plan tourist routes combining Metrorail, walking directions and attractions." },
    ],
  }),
  component: TouristPage,
});

// Tourist attractions near each station
const ATTRACTIONS: Record<string, { name: string; walk: string; tip: string }[]> = {
  "Cape Town": [
    { name: "V&A Waterfront", walk: "15 min walk", tip: "Iconic harbour with shops, restaurants and the Two Oceans Aquarium." },
    { name: "Bo-Kaap", walk: "10 min walk", tip: "Colourful Cape Malay neighbourhood with vibrant history." },
    { name: "Table Mountain Cable Car", walk: "20 min walk or MyCiti bus", tip: "Book tickets online to avoid queues." },
  ],
  "Simon's Town": [
    { name: "Boulders Beach Penguins", walk: "12 min walk", tip: "African penguin colony — arrive early morning for best experience." },
    { name: "Simon's Town Museum", walk: "5 min walk", tip: "Naval and local history — free entry." },
  ],
  "Muizenberg": [
    { name: "Muizenberg Beach", walk: "5 min walk", tip: "Iconic colourful beach huts — great for surfing lessons." },
    { name: "Surfers Corner", walk: "8 min walk", tip: "Best beginner surf spot in Cape Town." },
  ],
  "Khayelitsha": [
    { name: "Lookout Hill", walk: "20 min walk", tip: "Panoramic views over the township with cultural tours available." },
  ],
  "Stellenbosch": [
    { name: "Stellenbosch Village Museum", walk: "5 min walk", tip: "Historic Cape Dutch architecture." },
    { name: "Jonkershoek Nature Reserve", walk: "Taxi / 40 min walk", tip: "Hiking trails with mountain views." },
    { name: "Winelands Tour", walk: "Organised tours depart from station", tip: "Book a half-day wine route tour." },
  ],
  "Claremont": [
    { name: "Kirstenbosch Botanical Garden", walk: "MyCiti or 25 min walk", tip: "UNESCO heritage site — stunning flora." },
  ],
  "Fish Hoek": [
    { name: "Fish Hoek Beach", walk: "8 min walk", tip: "Calm, safe swimming beach — ideal for families." },
    { name: "Peer's Cave", walk: "30 min hike", tip: "San rock art site with valley views." },
  ],
};

type Step =
  | { type: "train"; trainNo: string; line: string; from: string; to: string; departure: string; arrival: string; platform: string }
  | { type: "walk"; from: string; duration: string }
  | { type: "attraction"; name: string; station: string; walk: string; tip: string };

function buildItinerary(from: string, to: string): Step[] {
  const steps: Step[] = [];

  // Find a direct or connecting train
  const direct = SCHEDULES.find((s) => {
    const stops = s.stops.map((x) => x.toLowerCase());
    const fi = stops.indexOf(from.toLowerCase());
    const ti = stops.indexOf(to.toLowerCase());
    return fi !== -1 && ti !== -1 && fi < ti;
  });

  if (direct) {
    steps.push({ type: "train", trainNo: direct.trainNo, line: direct.line, from, to, departure: direct.departure, arrival: direct.arrival, platform: direct.platform });
  } else {
    // Try a transfer via Cape Town
    const leg1 = SCHEDULES.find((s) => {
      const stops = s.stops.map((x) => x.toLowerCase());
      return stops.includes(from.toLowerCase()) && stops.includes("cape town");
    });
    const leg2 = SCHEDULES.find((s) => {
      const stops = s.stops.map((x) => x.toLowerCase());
      return stops.includes("cape town") && stops.includes(to.toLowerCase());
    });
    if (leg1) steps.push({ type: "train", trainNo: leg1.trainNo, line: leg1.line, from, to: "Cape Town", departure: leg1.departure, arrival: leg1.arrival, platform: leg1.platform });
    if (leg1 && leg2) steps.push({ type: "walk", from: "Cape Town", duration: "5–10 min platform transfer" });
    if (leg2) steps.push({ type: "train", trainNo: leg2.trainNo, line: leg2.line, from: "Cape Town", to, departure: leg2.departure, arrival: leg2.arrival, platform: leg2.platform });
  }

  // Walking directions to destination
  steps.push({ type: "walk", from: to, duration: "Exit station and follow signs" });

  // Attractions at destination
  const spots = ATTRACTIONS[to] ?? [];
  spots.forEach((a) => steps.push({ type: "attraction", name: a.name, station: to, walk: a.walk, tip: a.tip }));

  // Also add source attractions if different
  if (from !== to) {
    const srcSpots = ATTRACTIONS[from] ?? [];
    srcSpots.forEach((a) => steps.push({ type: "attraction", name: a.name, station: from, walk: a.walk, tip: a.tip }));
  }

  return steps;
}

function TouristPage() {
  const [from, setFrom] = useState("Cape Town");
  const [to, setTo] = useState("Simon's Town");
  const [itinerary, setItinerary] = useState<Step[] | null>(null);

  const plan = () => setItinerary(buildItinerary(from, to));

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <section className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-8">
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
            <Landmark className="h-6 w-6 text-destructive" /> Tourist Mode
          </h1>
          <p className="mt-1 text-sm opacity-90">Combine train routes, walking directions and top attractions for your visit.</p>
        </div>
      </section>

      <section className="container mx-auto flex-1 px-4 py-8 space-y-6">
        {/* Planner form */}
        <div className="rounded-md border border-border bg-card p-5 shadow-card space-y-4">
          <h2 className="text-base font-semibold text-foreground">Plan your tourist journey</h2>
          <div className="flex flex-wrap gap-4">
            <label className="flex flex-col gap-1 flex-1 min-w-[160px]">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">From</span>
              <select value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-sm border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30">
                {STATIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 flex-1 min-w-[160px]">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">To (Tourist Destination)</span>
              <select value={to} onChange={(e) => setTo(e.target.value)} className="rounded-sm border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30">
                {STATIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <button onClick={plan} className="flex items-center gap-2 rounded-sm bg-destructive px-5 py-2.5 text-sm font-semibold text-destructive-foreground hover:opacity-90">
            <MapPin className="h-4 w-4" /> Plan Tourist Route
          </button>
        </div>

        {/* Itinerary */}
        {itinerary && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">Your itinerary: {from} → {to}</h2>
            {itinerary.map((step, i) => (
              <ItineraryStep key={i} step={step} index={i + 1} />
            ))}
            {itinerary.filter((s) => s.type === "attraction").length === 0 && (
              <p className="rounded-sm border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
                No specific tourist attractions listed for <strong>{to}</strong> yet. Use the AI chatbot for personalised recommendations.
              </p>
            )}
          </div>
        )}

        {/* Tip card */}
        <div className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground mb-1">💡 Tourist Tips</p>
          <ul className="space-y-1 list-disc pl-4">
            <li>Buy a <strong>Day Tripper</strong> ticket at Cape Town station for unlimited rides.</li>
            <li>Trains run roughly every 30–60 minutes — check the schedule tab.</li>
            <li>Peak hours (06:00–09:00 and 16:00–19:00) are very busy — travel off-peak when possible.</li>
            <li>Keep valuables secure and travel with companions when possible.</li>
          </ul>
        </div>
      </section>

      <Footer />
      <Chatbot />
    </div>
  );
}

function ItineraryStep({ step, index }: { step: Step; index: number }) {
  if (step.type === "train") {
    return (
      <div className="flex gap-3 rounded-md border border-border bg-card p-4 shadow-card">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">{index}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Train className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground text-sm">Take the train</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{step.line}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span>{step.from}</span>
            <ArrowRight className="h-3 w-3" />
            <span>{step.to}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Train #{step.trainNo} · Departs {step.departure} · Arrives {step.arrival} · Platform {step.platform}
          </div>
        </div>
      </div>
    );
  }

  if (step.type === "walk") {
    return (
      <div className="flex gap-3 rounded-md border border-border bg-card p-4 shadow-card">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/80 text-white text-xs font-bold">{index}</div>
        <div className="flex items-center gap-2 text-sm">
          <Footprints className="h-4 w-4 text-warning" />
          <span className="font-semibold text-foreground">Walk</span>
          <span className="text-muted-foreground">from {step.from} — {step.duration}</span>
        </div>
      </div>
    );
  }

  // attraction
  return (
    <div className="flex gap-3 rounded-md border border-success/30 bg-success/5 p-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success text-white text-xs font-bold">{index}</div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-success" />
          <span className="font-semibold text-foreground text-sm">{step.name}</span>
          <span className="text-xs text-muted-foreground">near {step.station}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <Footprints className="h-3 w-3" /> {step.walk}
        </div>
        <div className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
          <Info className="h-3 w-3 mt-0.5 shrink-0" /> {step.tip}
        </div>
      </div>
    </div>
  );
}

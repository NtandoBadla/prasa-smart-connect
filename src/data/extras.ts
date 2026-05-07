import { SCHEDULES, type TrainSchedule } from "./prasa";

// Fare matrix (ZAR) — Metro / MetroPlus
export const TICKET_TYPES = [
  { id: "single", label: "Single", multiplier: 1 },
  { id: "return", label: "Return", multiplier: 1.8 },
  { id: "weekly", label: "Weekly", multiplier: 8 },
  { id: "monthly", label: "Monthly", multiplier: 28 },
] as const;

export type TicketTypeId = (typeof TICKET_TYPES)[number]["id"];

export const CLASS_MULTIPLIER = { Metro: 1, MetroPlus: 1.6 } as const;
export type TravelClass = keyof typeof CLASS_MULTIPLIER;

export function calcFare(
  baseFare: number,
  ticket: TicketTypeId,
  travelClass: TravelClass,
): number {
  const t = TICKET_TYPES.find((x) => x.id === ticket)!;
  return +(baseFare * t.multiplier * CLASS_MULTIPLIER[travelClass]).toFixed(2);
}

// Trip planning with one transfer (via hub)
export interface TripLeg {
  train: TrainSchedule;
}
export interface TripPlan {
  legs: TripLeg[];
  transfers: number;
  totalDuration: number; // minutes including layover
  totalFare: number;
  departure: string;
  arrival: string;
}

const HUBS = ["Cape Town", "Salt River", "Bellville", "Retreat"];

function timeToMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minToTime(m: number) {
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function trainServes(t: TrainSchedule, from: string, to: string) {
  const stops = t.stops.map((s) => s.toLowerCase());
  const fi = stops.indexOf(from.toLowerCase());
  const ti = stops.indexOf(to.toLowerCase());
  return fi !== -1 && ti !== -1 && fi < ti;
}

export function planTrip(from: string, to: string, afterTime?: string): TripPlan[] {
  const after = afterTime ? timeToMin(afterTime) : 0;

  const directAll = SCHEDULES.filter(
    (t) => trainServes(t, from, to) && t.status !== "Cancelled",
  );
  const directFiltered = directAll.filter((t) => timeToMin(t.departure) >= after);
  // If no trains after requested time, fall back to all trains on the route
  const directPool = directFiltered.length > 0 ? directFiltered : directAll;

  const direct: TripPlan[] = directPool.map((t) => ({
    legs: [{ train: t }],
    transfers: 0,
    totalDuration: t.durationMin,
    totalFare: t.fare,
    departure: t.departure,
    arrival: t.arrival,
  }));

  const transfers: TripPlan[] = [];
  for (const hub of HUBS) {
    if (hub.toLowerCase() === from.toLowerCase() || hub.toLowerCase() === to.toLowerCase()) continue;
    const firstLegsAll = SCHEDULES.filter(
      (t) => trainServes(t, from, hub) && t.status !== "Cancelled",
    );
    const firstLegs = firstLegsAll.filter((t) => timeToMin(t.departure) >= after);
    const firstPool = firstLegs.length > 0 ? firstLegs : firstLegsAll;

    for (const leg1 of firstPool) {
      const arriveHub = timeToMin(leg1.arrival);
      const secondLegs = SCHEDULES.filter(
        (t) =>
          trainServes(t, hub, to) &&
          timeToMin(t.departure) >= arriveHub + 5 &&
          timeToMin(t.departure) <= arriveHub + 60 &&
          t.status !== "Cancelled",
      );
      for (const leg2 of secondLegs) {
        transfers.push({
          legs: [{ train: leg1 }, { train: leg2 }],
          transfers: 1,
          totalDuration: timeToMin(leg2.arrival) - timeToMin(leg1.departure),
          totalFare: +(leg1.fare + leg2.fare).toFixed(2),
          departure: leg1.departure,
          arrival: leg2.arrival,
        });
      }
    }
  }

  return [...direct, ...transfers]
    .sort((a, b) => timeToMin(a.departure) - timeToMin(b.departure) || a.totalDuration - b.totalDuration)
    .slice(0, 6);
}

export { minToTime };

// ── Crowding engine (rule-based, no random) ──────────────────────────────────
export interface CoachLoad {
  coach: number;
  load: number; // 0-100
  level: "Low" | "Moderate" | "High" | "Full";
}

// Base crowding by line at peak vs off-peak
const LINE_BASE: Record<string, { peak: number; offPeak: number }> = {
  "Central Line":    { peak: 92, offPeak: 55 },
  "Cape Flats Line": { peak: 85, offPeak: 50 },
  "Southern Line":   { peak: 75, offPeak: 40 },
  "Northern Line":   { peak: 70, offPeak: 38 },
};

// Coach position bias: front/rear coaches fill first at terminus
// Values are load offsets per coach position (1=front, 8=rear)
const COACH_BIAS = [12, 8, 4, 0, -2, -6, -10, -14];

function isPeak(hour: number, dow: number): boolean {
  if (dow === 0 || dow === 6) return false; // weekend
  return (hour >= 6 && hour < 9) || (hour >= 16 && hour < 19);
}

export function getCrowding(
  trainNo: string,
  coaches = 8,
  line?: string,
  departureTime?: string,
): CoachLoad[] {
  const now = new Date();
  let hour = now.getHours();
  const dow = now.getDay();

  if (departureTime) {
    const [h] = departureTime.split(":").map(Number);
    hour = h;
  }

  const resolvedLine = line ?? SCHEDULES.find((s) => s.trainNo === trainNo)?.line ?? "Southern Line";
  const base = LINE_BASE[resolvedLine] ?? LINE_BASE["Southern Line"];
  const baseLoad = isPeak(hour, dow) ? base.peak : base.offPeak;

  return Array.from({ length: coaches }, (_, i) => {
    const bias = COACH_BIAS[i] ?? 0;
    const load = Math.min(100, Math.max(5, baseLoad + bias));
    const level: CoachLoad["level"] =
      load < 40 ? "Low" : load < 65 ? "Moderate" : load < 85 ? "High" : "Full";
    return { coach: i + 1, load, level };
  });
}

export function bestCoach(loads: CoachLoad[]): CoachLoad {
  return loads.reduce((a, b) => (a.load < b.load ? a : b));
}

// Human-readable crowding advice for chatbot
export function crowdingAdvice(line: string, departureTime?: string): string {
  const now = new Date();
  let hour = now.getHours();
  const dow = now.getDay();
  if (departureTime) hour = parseInt(departureTime.split(":")[0]);

  const peak = isPeak(hour, dow);
  const base = LINE_BASE[line] ?? LINE_BASE["Southern Line"];
  const loads = getCrowding("", 8, line, departureTime);
  const best = bestCoach(loads);

  return (
    `**${line} crowding (${peak ? "peak" : "off-peak"}):**\n` +
    `Overall occupancy ~${peak ? base.peak : base.offPeak}%\n` +
    `• Coaches 1–2 (front): High — fills first at Cape Town\n` +
    `• Coaches 3–5 (middle): Moderate\n` +
    `• Coaches 6–8 (rear): Low — least crowded\n\n` +
    `✅ **Best coach: ${best.coach}** (${best.load}% full, ${best.level} occupancy)\n` +
    `Tip: ${peak ? "It's peak hour — board early and move to rear coaches." : "Off-peak — most coaches have space."}`
  );
}

// News
export interface NewsItem {
  id: string;
  title: string;
  excerpt: string;
  category: "Network" | "Upgrade" | "Community" | "Press";
  date: string;
}

export const NEWS: NewsItem[] = [
  {
    id: "n1",
    title: "Central Line returns to full service after upgrade",
    excerpt:
      "Following extensive infrastructure rehabilitation, Metrorail Central Line trains now operate at full capacity between Cape Town and Khayelitsha.",
    category: "Network",
    date: "2025-04-22",
  },
  {
    id: "n2",
    title: "PRASA invests R450m in new signalling for Western Cape",
    excerpt:
      "A new digital signalling programme will improve safety, reduce delays and increase frequency on Southern and Northern lines.",
    category: "Upgrade",
    date: "2025-04-15",
  },
  {
    id: "n3",
    title: "Free travel for matric pupils on exam days",
    excerpt:
      "Grade 12 learners can travel free on Metrorail services on presentation of their exam admission letter at any station.",
    category: "Community",
    date: "2025-04-08",
  },
  {
    id: "n4",
    title: "Statement on weekend Southern Line works",
    excerpt:
      "Engineering teams will be on site this weekend at Muizenberg. Bus shuttles will be deployed between Muizenberg and Fish Hoek.",
    category: "Press",
    date: "2025-04-04",
  },
];

// Network map coordinates (simplified Cape Town layout)
export const NETWORK_LAYOUT: Record<string, { x: number; y: number; lines: string[] }> = {
  "Cape Town":     { x: 50,  y: 50,  lines: ["Southern Line", "Northern Line", "Central Line", "Cape Flats Line"] },
  "Salt River":    { x: 110, y: 80,  lines: ["Southern Line", "Northern Line", "Central Line", "Cape Flats Line"] },
  "Observatory":   { x: 130, y: 130, lines: ["Southern Line"] },
  "Mowbray":       { x: 145, y: 165, lines: ["Southern Line"] },
  "Rondebosch":    { x: 155, y: 195, lines: ["Southern Line"] },
  "Newlands":      { x: 165, y: 225, lines: ["Southern Line"] },
  "Claremont":     { x: 175, y: 255, lines: ["Southern Line"] },
  "Wynberg":       { x: 185, y: 290, lines: ["Southern Line"] },
  "Retreat":       { x: 200, y: 335, lines: ["Southern Line", "Cape Flats Line"] },
  "Muizenberg":    { x: 220, y: 380, lines: ["Southern Line"] },
  "Fish Hoek":     { x: 245, y: 425, lines: ["Southern Line"] },
  "Simon's Town":  { x: 270, y: 470, lines: ["Southern Line"] },
  "Pinelands":     { x: 175, y: 105, lines: ["Northern Line", "Cape Flats Line"] },
  "Goodwood":      { x: 240, y: 100, lines: ["Northern Line"] },
  "Parow":         { x: 305, y: 95,  lines: ["Northern Line"] },
  "Bellville":     { x: 380, y: 90,  lines: ["Northern Line"] },
  "Langa":         { x: 200, y: 165, lines: ["Central Line"] },
  "Nyanga":        { x: 260, y: 215, lines: ["Central Line", "Cape Flats Line"] },
  "Philippi":      { x: 320, y: 270, lines: ["Central Line", "Cape Flats Line"] },
  "Mitchells Plain": { x: 380, y: 320, lines: ["Central Line"] },
  "Khayelitsha":   { x: 440, y: 365, lines: ["Central Line"] },
  "Stellenbosch":  { x: 460, y: 50,  lines: ["Northern Line"] },
};

export const LINE_COLORS: Record<string, string> = {
  "Southern Line": "oklch(0.55 0.22 27)",      // red
  "Northern Line": "oklch(0.36 0.14 255)",     // blue
  "Central Line": "oklch(0.62 0.16 150)",      // green
  "Cape Flats Line": "oklch(0.75 0.16 75)",    // amber
};

export const LINE_PATHS: Record<string, string[]> = {
  "Southern Line": ["Cape Town", "Salt River", "Observatory", "Mowbray", "Rondebosch", "Newlands", "Claremont", "Wynberg", "Retreat", "Muizenberg", "Fish Hoek", "Simon's Town"],
  "Northern Line": ["Cape Town", "Salt River", "Pinelands", "Goodwood", "Parow", "Bellville", "Stellenbosch"],
  "Central Line": ["Cape Town", "Salt River", "Langa", "Nyanga", "Philippi", "Mitchells Plain", "Khayelitsha"],
  "Cape Flats Line": ["Cape Town", "Salt River", "Pinelands", "Nyanga", "Philippi", "Retreat"],
};

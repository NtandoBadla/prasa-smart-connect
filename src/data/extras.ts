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
  const direct: TripPlan[] = SCHEDULES.filter(
    (t) => trainServes(t, from, to) && timeToMin(t.departure) >= after && t.status !== "Cancelled",
  ).map((t) => ({
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
    const firstLegs = SCHEDULES.filter(
      (t) => trainServes(t, from, hub) && timeToMin(t.departure) >= after && t.status !== "Cancelled",
    );
    for (const leg1 of firstLegs) {
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

// Train coach crowding (deterministic mock based on trainNo + hour)
export interface CoachLoad {
  coach: number;
  load: number; // 0-100
  level: "Low" | "Moderate" | "High" | "Full";
}

function seedRand(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

export function getCrowding(trainNo: string, coaches = 8): CoachLoad[] {
  const seed = parseInt(trainNo, 10) + new Date().getHours();
  const rand = seedRand(seed);
  return Array.from({ length: coaches }, (_, i) => {
    const load = Math.round(25 + rand() * 70);
    const level: CoachLoad["level"] =
      load < 40 ? "Low" : load < 65 ? "Moderate" : load < 85 ? "High" : "Full";
    return { coach: i + 1, load, level };
  });
}

export function bestCoach(loads: CoachLoad[]): CoachLoad {
  return loads.reduce((a, b) => (a.load < b.load ? a : b));
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

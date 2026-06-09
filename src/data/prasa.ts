// PRASA Metrorail Western Cape — schedule data
export type Station = string;

export const STATION_COORDS: Record<string, { lat: number; lng: number }> = {
  "Cape Town":       { lat: -33.9258, lng: 18.4232 },
  "Woodstock":       { lat: -33.9274, lng: 18.4399 },
  "Salt River":      { lat: -33.9298, lng: 18.4648 },
  "Observatory":     { lat: -33.9375, lng: 18.4724 },
  "Mowbray":         { lat: -33.9436, lng: 18.4730 },
  "Rondebosch":      { lat: -33.9565, lng: 18.4738 },
  "Newlands":        { lat: -33.9701, lng: 18.4669 },
  "Claremont":       { lat: -33.9813, lng: 18.4677 },
  "Wynberg":         { lat: -33.9976, lng: 18.4680 },
  "Retreat":         { lat: -34.0298, lng: 18.4856 },
  "Muizenberg":      { lat: -34.0979, lng: 18.4716 },
  "Fish Hoek":       { lat: -34.1357, lng: 18.4261 },
  "Simon's Town":    { lat: -34.1882, lng: 18.4278 },
  "Bellville":       { lat: -33.9001, lng: 18.6295 },
  "Parow":           { lat: -33.9052, lng: 18.5986 },
  "Goodwood":        { lat: -33.9044, lng: 18.5604 },
  "Khayelitsha":     { lat: -34.0411, lng: 18.6726 },
  "Mitchells Plain": { lat: -34.0334, lng: 18.6241 },
  "Philippi":        { lat: -33.9981, lng: 18.5896 },
  "Nyanga":          { lat: -33.9851, lng: 18.5556 },
  "Langa":           { lat: -33.9491, lng: 18.5259 },
  "Pinelands":       { lat: -33.9372, lng: 18.5074 },
  "Stellenbosch":    { lat: -33.9355, lng: 18.8605 },
  "Koeberg Road":    { lat: -33.9213, lng: 18.5102 },
  "Maitland":        { lat: -33.9175, lng: 18.5156 },
  "Woltemade":       { lat: -33.9140, lng: 18.5219 },
  "Mutual":          { lat: -33.9099, lng: 18.5302 },
  "Thornton":        { lat: -33.9071, lng: 18.5398 },
  "Vasco":           { lat: -33.9040, lng: 18.5721 },
  "Elsies River":    { lat: -33.9013, lng: 18.5842 },
  "Tygerberg":       { lat: -33.8980, lng: 18.6132 },
  "Kuils River":     { lat: -33.9318, lng: 18.6811 },
  "Blackheath":      { lat: -33.9476, lng: 18.7086 },
  "Meltonrose":      { lat: -33.9591, lng: 18.7301 },
  "Eerste River":    { lat: -33.9720, lng: 18.7538 },
  "Lynedoch":        { lat: -33.9901, lng: 18.7931 },
  "Vlottenburg":     { lat: -34.0012, lng: 18.8178 },
  "Du Toit":         { lat: -33.9211, lng: 18.8812 },
};

export interface TrainSchedule {
  id: string;
  trainNo: string;
  line: "Southern Line" | "Northern Line" | "Central Line" | "Cape Flats Line";
  from: Station;
  to: Station;
  departure: string;
  arrival: string;
  durationMin: number;
  stops: Station[];
  status: "On Time" | "Delayed" | "Cancelled";
  delayMin?: number;
  platform: string;
  fare: number;
}

export interface ServiceAlert {
  id: string;
  level: "info" | "warning" | "critical";
  title: string;
  message: string;
  line?: string;
  postedAt: string;
}

export const STATIONS: Station[] = [
  "Cape Town",
  "Woodstock",
  "Salt River",
  "Observatory",
  "Mowbray",
  "Rondebosch",
  "Newlands",
  "Claremont",
  "Wynberg",
  "Retreat",
  "Muizenberg",
  "Fish Hoek",
  "Simon's Town",
  "Bellville",
  "Parow",
  "Goodwood",
  "Khayelitsha",
  "Mitchells Plain",
  "Philippi",
  "Nyanga",
  "Langa",
  "Pinelands",
  "Stellenbosch",
  "Koeberg Road",
  "Maitland",
  "Woltemade",
  "Mutual",
  "Thornton",
  "Vasco",
  "Elsies River",
  "Tygerberg",
  "Kuils River",
  "Blackheath",
  "Meltonrose",
  "Eerste River",
  "Lynedoch",
  "Vlottenburg",
  "Du Toit",
];

// ── Full stops per line (both directions) ─────────────────────────────────────
const SOUTHERN_DOWN = ["Cape Town", "Woodstock", "Salt River", "Observatory", "Mowbray", "Rondebosch", "Newlands", "Claremont", "Wynberg", "Retreat", "Muizenberg", "Fish Hoek", "Simon's Town"];
const SOUTHERN_UP   = [...SOUTHERN_DOWN].reverse();

const NORTHERN_DOWN = ["Cape Town", "Woodstock", "Salt River", "Pinelands", "Goodwood", "Parow", "Bellville", "Stellenbosch"];
const NORTHERN_UP   = [...NORTHERN_DOWN].reverse();

const CENTRAL_DOWN  = ["Cape Town", "Woodstock", "Salt River", "Langa", "Nyanga", "Philippi", "Mitchells Plain", "Khayelitsha"];
const CENTRAL_UP    = [...CENTRAL_DOWN].reverse();

const CAPEFLATS_DOWN = ["Cape Town", "Salt River", "Pinelands", "Nyanga", "Philippi", "Retreat"];
const CAPEFLATS_UP   = [...CAPEFLATS_DOWN].reverse();

// ── Fare lookup (ZAR) ─────────────────────────────────────────────────────────
const FARES: Record<string, number> = {
  "Southern Line": 14.5,
  "Northern Line": 13.0,
  "Central Line":  12.5,
  "Cape Flats Line": 12.0,
};

// ── Helper: add minutes to HH:mm ─────────────────────────────────────────────
function addMin(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// ── Build a schedule entry ────────────────────────────────────────────────────
function make(
  id: string,
  trainNo: string,
  line: TrainSchedule["line"],
  stops: string[],
  departure: string,
  durationMin: number,
  platform: string,
  status: TrainSchedule["status"] = "On Time",
  delayMin?: number,
): TrainSchedule {
  return {
    id,
    trainNo,
    line,
    from: stops[0],
    to: stops[stops.length - 1],
    departure,
    arrival: addMin(departure, durationMin),
    durationMin,
    stops,
    status,
    delayMin,
    platform,
    fare: FARES[line],
  };
}

export const SCHEDULES: TrainSchedule[] = [
  // ── Southern Line — Cape Town → Simon's Town ──────────────────────────────
  make("S1",  "0412", "Southern Line", SOUTHERN_DOWN, "05:50", 77, "11"),
  make("S2",  "0428", "Southern Line", SOUTHERN_DOWN, "06:30", 77, "11"),
  make("S3",  "0444", "Southern Line", SOUTHERN_DOWN, "07:05", 80, "12", "Delayed", 12),
  make("S4",  "0460", "Southern Line", SOUTHERN_DOWN, "08:00", 77, "11"),
  make("S5",  "0476", "Southern Line", SOUTHERN_DOWN, "09:30", 77, "11"),
  make("S6",  "0492", "Southern Line", SOUTHERN_DOWN, "12:00", 77, "11"),
  make("S7",  "0508", "Southern Line", SOUTHERN_DOWN, "15:00", 77, "11"),
  make("S8",  "0524", "Southern Line", SOUTHERN_DOWN, "17:00", 80, "12"),
  make("S9",  "0540", "Southern Line", SOUTHERN_DOWN, "18:30", 77, "11"),

  // ── Southern Line — Simon's Town → Cape Town ──────────────────────────────
  make("S10", "0413", "Southern Line", SOUTHERN_UP, "05:00", 77, "1"),
  make("S11", "0429", "Southern Line", SOUTHERN_UP, "06:00", 77, "1"),
  make("S12", "0445", "Southern Line", SOUTHERN_UP, "07:10", 80, "2"),
  make("S13", "0461", "Southern Line", SOUTHERN_UP, "08:15", 77, "1"),
  make("S14", "0477", "Southern Line", SOUTHERN_UP, "10:00", 77, "1"),
  make("S15", "0493", "Southern Line", SOUTHERN_UP, "12:30", 77, "1"),
  make("S16", "0516", "Southern Line", SOUTHERN_UP, "16:42", 78, "1"),
  make("S17", "0532", "Southern Line", SOUTHERN_UP, "17:45", 77, "2"),
  make("S18", "0548", "Southern Line", SOUTHERN_UP, "19:00", 77, "1"),

  // ── Northern Line — Cape Town → Stellenbosch ──────────────────────────────
  make("N1",  "1102", "Northern Line", NORTHERN_DOWN, "05:45", 65, "5"),
  make("N2",  "1118", "Northern Line", NORTHERN_DOWN, "06:30", 65, "5"),
  make("N3",  "1134", "Northern Line", NORTHERN_DOWN, "07:15", 65, "6"),
  make("N4",  "1150", "Northern Line", NORTHERN_DOWN, "08:00", 65, "5"),
  make("N5",  "1166", "Northern Line", NORTHERN_DOWN, "09:00", 65, "5"),
  make("N6",  "1182", "Northern Line", NORTHERN_DOWN, "12:00", 65, "5"),
  make("N7",  "1198", "Northern Line", NORTHERN_DOWN, "15:00", 65, "5"),
  make("N8",  "1206", "Northern Line", NORTHERN_DOWN, "17:15", 65, "—", "Cancelled"),
  make("N9",  "1214", "Northern Line", NORTHERN_DOWN, "18:00", 65, "6"),

  // ── Northern Line — Stellenbosch → Cape Town ──────────────────────────────
  make("N10", "1103", "Northern Line", NORTHERN_UP, "05:00", 65, "2"),
  make("N11", "1119", "Northern Line", NORTHERN_UP, "06:00", 65, "2"),
  make("N12", "1124", "Northern Line", NORTHERN_UP, "07:10", 65, "2"),
  make("N13", "1135", "Northern Line", NORTHERN_UP, "08:00", 65, "3"),
  make("N14", "1151", "Northern Line", NORTHERN_UP, "09:30", 65, "2"),
  make("N15", "1167", "Northern Line", NORTHERN_UP, "12:30", 65, "2"),
  make("N16", "1183", "Northern Line", NORTHERN_UP, "15:30", 65, "2"),
  make("N17", "1199", "Northern Line", NORTHERN_UP, "17:00", 65, "3"),
  make("N18", "1215", "Northern Line", NORTHERN_UP, "18:30", 65, "2"),

  // ── Central Line — Cape Town → Khayelitsha ────────────────────────────────
  make("C1",  "2208", "Central Line", CENTRAL_DOWN, "05:30", 70, "8"),
  make("C2",  "2224", "Central Line", CENTRAL_DOWN, "06:45", 70, "8", "Delayed", 18),
  make("C3",  "2240", "Central Line", CENTRAL_DOWN, "07:30", 70, "8"),
  make("C4",  "2256", "Central Line", CENTRAL_DOWN, "08:30", 70, "8"),
  make("C5",  "2272", "Central Line", CENTRAL_DOWN, "10:00", 70, "8"),
  make("C6",  "2288", "Central Line", CENTRAL_DOWN, "12:00", 70, "8"),
  make("C7",  "2304", "Central Line", CENTRAL_DOWN, "15:00", 70, "8"),
  make("C8",  "2320", "Central Line", CENTRAL_DOWN, "17:00", 70, "8"),
  make("C9",  "2336", "Central Line", CENTRAL_DOWN, "18:30", 70, "8"),

  // ── Central Line — Khayelitsha → Cape Town ────────────────────────────────
  make("C10", "2209", "Central Line", CENTRAL_UP, "05:00", 70, "4"),
  make("C11", "2225", "Central Line", CENTRAL_UP, "06:00", 70, "4"),
  make("C12", "2241", "Central Line", CENTRAL_UP, "07:00", 70, "4"),
  make("C13", "2257", "Central Line", CENTRAL_UP, "08:00", 70, "4"),
  make("C14", "2273", "Central Line", CENTRAL_UP, "09:30", 70, "4"),
  make("C15", "2289", "Central Line", CENTRAL_UP, "12:30", 70, "4"),
  make("C16", "2305", "Central Line", CENTRAL_UP, "15:30", 70, "4"),
  make("C17", "2321", "Central Line", CENTRAL_UP, "17:00", 70, "4"),
  make("C18", "2337", "Central Line", CENTRAL_UP, "18:30", 70, "4"),

  // ── Cape Flats Line — Cape Town → Retreat ────────────────────────────────
  make("F1",  "3102", "Cape Flats Line", CAPEFLATS_DOWN, "06:00", 58, "9"),
  make("F2",  "3118", "Cape Flats Line", CAPEFLATS_DOWN, "07:20", 58, "9"),
  make("F3",  "3134", "Cape Flats Line", CAPEFLATS_DOWN, "08:30", 58, "9"),
  make("F4",  "3150", "Cape Flats Line", CAPEFLATS_DOWN, "12:00", 58, "9"),
  make("F5",  "3166", "Cape Flats Line", CAPEFLATS_DOWN, "17:00", 58, "9"),
  make("F6",  "3182", "Cape Flats Line", CAPEFLATS_DOWN, "18:30", 58, "9"),

  // ── Cape Flats Line — Retreat → Cape Town ────────────────────────────────
  make("F7",  "3103", "Cape Flats Line", CAPEFLATS_UP, "05:30", 58, "7"),
  make("F8",  "3119", "Cape Flats Line", CAPEFLATS_UP, "06:30", 58, "7"),
  make("F9",  "3135", "Cape Flats Line", CAPEFLATS_UP, "07:45", 58, "7"),
  make("F10", "3151", "Cape Flats Line", CAPEFLATS_UP, "12:30", 58, "7"),
  make("F11", "3167", "Cape Flats Line", CAPEFLATS_UP, "17:30", 58, "7"),
  make("F12", "3183", "Cape Flats Line", CAPEFLATS_UP, "19:00", 58, "7"),
];

export const ALERTS: ServiceAlert[] = [
  {
    id: "a1",
    level: "critical",
    title: "Northern Line: Train 1206 cancelled",
    message: "The 17:15 from Cape Town to Stellenbosch is cancelled due to signal failure. Next service at 18:00.",
    line: "Northern Line",
    postedAt: "2025-04-24T14:10:00Z",
  },
  {
    id: "a2",
    level: "warning",
    title: "Central Line delays of up to 20 minutes",
    message: "Cable theft between Langa and Nyanga is causing delays. Maintenance teams on site.",
    line: "Central Line",
    postedAt: "2025-04-24T12:30:00Z",
  },
  {
    id: "a3",
    level: "info",
    title: "Southern Line weekend works",
    message: "Engineering work between Muizenberg and Fish Hoek this Sunday from 06:00 to 14:00. Bus shuttles in operation.",
    line: "Southern Line",
    postedAt: "2025-04-23T09:00:00Z",
  },
];

export function searchTrains(from: string, to: string, time?: string): TrainSchedule[] {
  const f = from.trim().toLowerCase();
  const t = to.trim().toLowerCase();
  const all = SCHEDULES.filter((s) => {
    const stops = s.stops.map((x) => x.toLowerCase());
    const fi = stops.indexOf(f);
    const ti = stops.indexOf(t);
    return fi !== -1 && ti !== -1 && fi < ti;
  }).sort((a, b) => a.departure.localeCompare(b.departure));

  if (!time) return all;

  // Return trains departing at or after the requested time
  const afterTime = all.filter((s) => s.departure >= time);

  // If nothing runs after that time, wrap around and show all trains for the route
  // so the user always sees options rather than an empty result
  return afterTime.length > 0 ? afterTime : all;
}

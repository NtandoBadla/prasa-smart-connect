// Mock PRASA (Metrorail Western Cape) data — Cape Town focus
export type Station = string;

export interface TrainSchedule {
  id: string;
  trainNo: string;
  line: "Southern Line" | "Northern Line" | "Central Line" | "Cape Flats Line";
  from: Station;
  to: Station;
  departure: string; // HH:mm
  arrival: string;
  durationMin: number;
  stops: Station[];
  status: "On Time" | "Delayed" | "Cancelled";
  delayMin?: number;
  platform: string;
  fare: number; // ZAR
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
];

export const SCHEDULES: TrainSchedule[] = [
  {
    id: "S1",
    trainNo: "0412",
    line: "Southern Line",
    from: "Cape Town",
    to: "Simon's Town",
    departure: "06:15",
    arrival: "07:32",
    durationMin: 77,
    stops: ["Cape Town", "Salt River", "Observatory", "Claremont", "Wynberg", "Retreat", "Muizenberg", "Fish Hoek", "Simon's Town"],
    status: "On Time",
    platform: "11",
    fare: 14.5,
  },
  {
    id: "S2",
    trainNo: "0428",
    line: "Southern Line",
    from: "Cape Town",
    to: "Simon's Town",
    departure: "07:05",
    arrival: "08:25",
    durationMin: 80,
    stops: ["Cape Town", "Salt River", "Observatory", "Mowbray", "Rondebosch", "Claremont", "Wynberg", "Retreat", "Muizenberg", "Fish Hoek", "Simon's Town"],
    status: "Delayed",
    delayMin: 12,
    platform: "12",
    fare: 14.5,
  },
  {
    id: "N1",
    trainNo: "1102",
    line: "Northern Line",
    from: "Cape Town",
    to: "Bellville",
    departure: "06:30",
    arrival: "07:05",
    durationMin: 35,
    stops: ["Cape Town", "Salt River", "Pinelands", "Goodwood", "Parow", "Bellville"],
    status: "On Time",
    platform: "5",
    fare: 11,
  },
  {
    id: "N2",
    trainNo: "1124",
    line: "Northern Line",
    from: "Bellville",
    to: "Cape Town",
    departure: "07:10",
    arrival: "07:48",
    durationMin: 38,
    stops: ["Bellville", "Parow", "Goodwood", "Pinelands", "Salt River", "Cape Town"],
    status: "On Time",
    platform: "2",
    fare: 11,
  },
  {
    id: "C1",
    trainNo: "2208",
    line: "Central Line",
    from: "Cape Town",
    to: "Khayelitsha",
    departure: "06:45",
    arrival: "07:55",
    durationMin: 70,
    stops: ["Cape Town", "Salt River", "Langa", "Nyanga", "Philippi", "Mitchells Plain", "Khayelitsha"],
    status: "Delayed",
    delayMin: 18,
    platform: "8",
    fare: 12.5,
  },
  {
    id: "C2",
    trainNo: "2240",
    line: "Cape Flats Line",
    from: "Cape Town",
    to: "Retreat",
    departure: "07:20",
    arrival: "08:18",
    durationMin: 58,
    stops: ["Cape Town", "Salt River", "Pinelands", "Nyanga", "Philippi", "Retreat"],
    status: "On Time",
    platform: "9",
    fare: 12,
  },
  {
    id: "S3",
    trainNo: "0516",
    line: "Southern Line",
    from: "Simon's Town",
    to: "Cape Town",
    departure: "16:42",
    arrival: "18:00",
    durationMin: 78,
    stops: ["Simon's Town", "Fish Hoek", "Muizenberg", "Retreat", "Wynberg", "Claremont", "Observatory", "Salt River", "Cape Town"],
    status: "On Time",
    platform: "1",
    fare: 14.5,
  },
  {
    id: "N3",
    trainNo: "1206",
    line: "Northern Line",
    from: "Cape Town",
    to: "Bellville",
    departure: "17:15",
    arrival: "17:52",
    durationMin: 37,
    stops: ["Cape Town", "Salt River", "Pinelands", "Goodwood", "Parow", "Bellville"],
    status: "Cancelled",
    platform: "—",
    fare: 11,
  },
];

export const ALERTS: ServiceAlert[] = [
  {
    id: "a1",
    level: "critical",
    title: "Northern Line: Train 1206 cancelled",
    message: "The 17:15 from Cape Town to Bellville is cancelled due to signal failure. Next service at 17:45.",
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
  let results = SCHEDULES.filter((s) => {
    const stops = s.stops.map((x) => x.toLowerCase());
    const fi = stops.indexOf(f);
    const ti = stops.indexOf(t);
    return fi !== -1 && ti !== -1 && fi < ti;
  });
  if (time) {
    results = results.filter((s) => s.departure >= time);
  }
  return results.sort((a, b) => a.departure.localeCompare(b.departure));
}

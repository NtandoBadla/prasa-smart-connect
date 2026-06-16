import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// ── Route definitions ─────────────────────────────────────────────────────────
const ROUTE_DOWN = "stellenbosch-down";
const ROUTE_UP   = "stellenbosch-up";

const STOPS_DOWN = [
  "Cape Town","Woodstock","Salt River","Koeberg Road","Maitland","Woltemade",
  "Mutual","Thornton","Goodwood","Vasco","Elsies River","Parow","Tygerberg",
  "Bellville","Kuils River","Blackheath","Meltonrose","Eerste River",
  "Lynedoch","Vlottenburg","Stellenbosch","Du Toit",
];

const STOPS_UP = [
  "Du Toit","Stellenbosch","Vlottenburg","Lynedoch","Eerste River",
  "Meltonrose","Blackheath","Kuils River","Bellville","Tygerberg",
  "Parow","Elsies River","Vasco","Goodwood","Thornton","Mutual",
  "Woltemade","Maitland","Koeberg Road","Salt River","Woodstock","Cape Town",
];

const COORDS: Record<string, [number, number]> = {
  "Cape Town":    [-33.9258, 18.4232],
  "Woodstock":    [-33.9274, 18.4399],
  "Salt River":   [-33.9298, 18.4648],
  "Koeberg Road": [-33.9213, 18.5102],
  "Maitland":     [-33.9175, 18.5156],
  "Woltemade":    [-33.9140, 18.5219],
  "Mutual":       [-33.9099, 18.5302],
  "Thornton":     [-33.9071, 18.5398],
  "Goodwood":     [-33.9044, 18.5604],
  "Vasco":        [-33.9040, 18.5721],
  "Elsies River": [-33.9013, 18.5842],
  "Parow":        [-33.9052, 18.5986],
  "Tygerberg":    [-33.8980, 18.6132],
  "Bellville":    [-33.9001, 18.6295],
  "Kuils River":  [-33.9318, 18.6811],
  "Blackheath":   [-33.9476, 18.7086],
  "Meltonrose":   [-33.9591, 18.7301],
  "Eerste River": [-33.9720, 18.7538],
  "Lynedoch":     [-33.9901, 18.7931],
  "Vlottenburg":  [-34.0012, 18.8178],
  "Stellenbosch": [-33.9355, 18.8605],
  "Du Toit":      [-33.9211, 18.8812],
};

// ── Down timetable: Cape Town → Du Toit (Mon-Fri) ────────────────────────────
// null = train skips that stop
const DOWN_TIMES: Record<string, (string | null)[]> = {
  "Cape Town":    ["04:30","05:35","06:15","07:45","09:55","12:30","15:00","16:20","17:45"],
  "Woodstock":    ["04:39","05:44", null,  "07:48","09:58","12:33","15:03", null,  "17:48"],
  "Salt River":   ["04:45","05:50", null,  "07:50","10:00","12:35","15:05", null,  "17:50"],
  "Koeberg Road": ["04:51","05:56", null,  "07:52","10:02","12:37","15:07", null,  "17:52"],
  "Maitland":     ["04:55","06:00", null,  "07:55","10:05","12:40","15:10", null,  "17:55"],
  "Woltemade":    ["04:59","06:04", null,  "07:58","10:08","12:43","15:13", null,  "17:58"],
  "Mutual":       ["05:10","06:15", null,  "08:00","10:10","12:45","15:15", null,  "18:00"],
  "Thornton":     ["05:16","06:21", null,  "08:04","10:14","12:49","15:19", null,  "18:04"],
  "Goodwood":     ["05:18","06:23", null,  "08:07","10:17","12:52","15:22", null,  "18:07"],
  "Vasco":        [ null,   null,   null,  "08:10","10:20","12:55","15:25", null,  "18:10"],
  "Elsies River": [ null,   null,   null,  "08:13","10:23","12:58","15:28", null,  "18:13"],
  "Parow":        [ null,   null,   null,  "08:15","10:25","13:00","15:30", null,  "18:15"],
  "Tygerberg":    [ null,   null,   null,  "08:19","10:29","13:04","15:34", null,  "18:19"],
  "Bellville":    [ null,   null,  "07:10","08:25","10:35","13:10","15:40","17:15","18:25"],
  "Kuils River":  [ null,   null,  "07:11","08:26","10:36","13:11","15:41","17:15","18:26"],
  "Blackheath":   [ null,   null,  "07:20","08:35","10:45","13:20","15:50","17:24","18:35"],
  "Meltonrose":   [ null,   null,  "07:26","08:41","10:51","13:26","15:56","17:30","18:41"],
  "Eerste River": ["04:55","06:00","07:32","08:47","10:57","13:32","16:02","17:36","18:47"],
  "Lynedoch":     ["04:59","06:04","07:40","08:55","11:05","13:40","16:10","17:44","18:55"],
  "Vlottenburg":  ["05:10","06:15","07:51","09:06","11:16","13:51","16:21","17:55","19:06"],
  "Stellenbosch": ["05:16","06:21","07:57","09:12","11:22","13:57","16:27","18:01","19:12"],
  "Du Toit":      ["05:18","06:23","07:59","09:14","11:24","13:59","16:29","18:03","19:14"],
};
const DOWN_TRAINS = ["3401","3403","3405","3407","3409","3411","3413","3415","3417"];

// ── Up timetable: Du Toit → Cape Town (Mon-Fri) ───────────────────────────────
const UP_TIMES: Record<string, (string | null)[]> = {
  "Du Toit":      ["05:32","06:42","08:12","09:35","11:45","14:30","17:05","18:25"],
  "Stellenbosch": ["05:34","06:44","08:14","09:37","11:47","14:32","17:07","18:27"],
  "Vlottenburg":  ["05:40","06:50","08:20","09:43","11:53","14:38","17:13","18:33"],
  "Lynedoch":     ["05:51","07:01","08:31","09:54","12:04","14:49","17:24","18:44"],
  "Eerste River": ["05:55","07:05","08:35","09:58","12:08","14:53","17:28","18:48"],
  "Meltonrose":   ["06:00","07:10","08:40","10:03","12:13","14:58","17:33","18:53"],
  "Blackheath":   ["06:05","07:15","08:45","10:08","12:18","15:03","17:38","18:58"],
  "Kuils River":  ["06:11","07:21","08:51","10:14","12:24","15:09","17:44","19:04"],
  "Bellville":    ["06:20","07:30","09:00","10:23","12:33","15:18","17:53","19:13"],
  "Tygerberg":    ["06:32", null,   null,  "10:30","12:40","15:27","18:00", null ],
  "Parow":        ["06:36", null,   null,  "10:34","12:44","15:31","18:04", null ],
  "Elsies River": ["06:38", null,   null,  "10:36","12:46","15:33","18:06", null ],
  "Vasco":        ["06:41", null,   null,  "10:39","12:49","15:36","18:09", null ],
  "Goodwood":     ["06:44", null,   null,  "10:42","12:52","15:39","18:12", null ],
  "Thornton":     ["06:47", null,   null,  "10:45","12:55","15:42","18:15", null ],
  "Mutual":       ["06:51", null,   null,  "10:49","12:59","15:46","18:19", null ],
  "Woltemade":    ["06:53", null,   null,  "10:51","13:01","15:48","18:21", null ],
  "Maitland":     ["06:56", null,   null,  "10:54","13:04","15:51","18:24", null ],
  "Koeberg Road": ["06:59", null,   null,  "10:57","13:07","15:54","18:27", null ],
  "Salt River":   ["07:01", null,   null,  "10:59","13:09","15:56","18:29", null ],
  "Woodstock":    ["07:03", null,   null,  "11:01","13:11","15:58","18:31", null ],
  "Cape Town":    ["07:06","08:26","09:56","11:04","13:14","16:01","18:34", null ],
};
const UP_TRAINS = ["3400","3402","3404","3406","3408","3410","3412","3414"];

async function seed() {
  console.log("Seeding PRASA Stellenbosch Line timetable...");

  // ── Routes ──────────────────────────────────────────────────────────────────
  const { error: rErr } = await sb.from("prasa_routes").upsert([
    { id: ROUTE_DOWN, line_name: "Stellenbosch Line", direction: "down", from_station: "Cape Town", to_station: "Du Toit", days_of_operation: "Mon-Fri" },
    { id: ROUTE_UP,   line_name: "Stellenbosch Line", direction: "up",   from_station: "Du Toit",   to_station: "Cape Town", days_of_operation: "Mon-Fri" },
  ], { onConflict: "id" });
  if (rErr) { console.error("Routes error:", rErr.message); process.exit(1); }
  console.log("Routes upserted.");

  // ── Stations ─────────────────────────────────────────────────────────────────
  const stationRows = [
    ...STOPS_DOWN.map((s, i) => ({
      route_id: ROUTE_DOWN, station_name: s, stop_order: i + 1,
      lat: COORDS[s]?.[0] ?? null, lng: COORDS[s]?.[1] ?? null,
    })),
    ...STOPS_UP.map((s, i) => ({
      route_id: ROUTE_UP, station_name: s, stop_order: i + 1,
      lat: COORDS[s]?.[0] ?? null, lng: COORDS[s]?.[1] ?? null,
    })),
  ];

  // Delete existing and re-insert for clean seed
  await sb.from("prasa_stations").delete().in("route_id", [ROUTE_DOWN, ROUTE_UP]);
  const { error: sErr } = await sb.from("prasa_stations").insert(stationRows);
  if (sErr) { console.error("Stations error:", sErr.message); process.exit(1); }
  console.log(`Stations inserted: ${stationRows.length} rows.`);

  // ── Timetable ─────────────────────────────────────────────────────────────────
  await sb.from("prasa_timetable").delete().in("route_id", [ROUTE_DOWN, ROUTE_UP]);

  const timetableRows: object[] = [];

  // Down
  for (const [stationIdx, station] of STOPS_DOWN.entries()) {
    const times = DOWN_TIMES[station] ?? [];
    for (const [trainIdx, trainNo] of DOWN_TRAINS.entries()) {
      const dep = times[trainIdx];
      if (!dep) continue; // train skips this stop
      timetableRows.push({
        route_id: ROUTE_DOWN,
        train_no: trainNo,
        station_name: station,
        stop_order: stationIdx + 1,
        departure: dep,
        platform: null,
      });
    }
  }

  // Up
  for (const [stationIdx, station] of STOPS_UP.entries()) {
    const times = UP_TIMES[station] ?? [];
    for (const [trainIdx, trainNo] of UP_TRAINS.entries()) {
      const dep = times[trainIdx];
      if (!dep) continue;
      timetableRows.push({
        route_id: ROUTE_UP,
        train_no: trainNo,
        station_name: station,
        stop_order: stationIdx + 1,
        departure: dep,
        platform: null,
      });
    }
  }

  const { error: tErr } = await sb.from("prasa_timetable").insert(timetableRows);
  if (tErr) { console.error("Timetable error:", tErr.message); process.exit(1); }
  console.log(`Timetable inserted: ${timetableRows.length} stop-time rows.`);
  console.log("Done.");
}

// ═══════════════════════════════════════════════════════════════════════════════
// CENTRAL LINE — Khayelitsha/Chris Hani Branch
// ═══════════════════════════════════════════════════════════════════════════════

// Route IDs
const CL_CHRIS_HANI_DOWN   = "central-chris-hani-down";   // Chris Hani → Cape Town
const CL_CHRIS_HANI_UP     = "central-chris-hani-up";     // Cape Town → Chris Hani
const CL_NONKQUBELA_UP     = "central-nonkqubela-up";     // Nonkqubela → Chris Hani (weekday)
const CL_NONKQUBELA_UP_SAT = "central-nonkqubela-up-sat"; // Nonkqubela → Chris Hani (Saturday)
const CL_NONKQUBELA_DOWN   = "central-nonkqubela-down";   // Nonkqubela → Cape Town

// ── Station stop lists ────────────────────────────────────────────────────────
// Route 1: Chris Hani → Cape Town (down direction)
const CL_STOPS_CH_DOWN = [
  "Chris Hani", "Khayelitsha", "Nonkqubela", "Nolungile", "Mandalay",
  "Stock Road", "Philippi", "Nyanga", "Bonteheuwel", "Langa",
  "Mutual", "Ysterplaat", "Paarden Eiland", "Esplanade", "Cape Town",
];

// Route 1 return: Cape Town → Chris Hani (up direction)
const CL_STOPS_CH_UP = [...CL_STOPS_CH_DOWN].reverse();

// Route 2: Nonkqubela → Chris Hani
const CL_STOPS_NQ_UP = [
  "Nonkqubela", "Nolungile", "Khayelitsha", "Chris Hani",
];

// Route 3: Nonkqubela → Cape Town
const CL_STOPS_NQ_DOWN = [
  "Nonkqubela", "Nolungile", "Mandalay", "Stock Road", "Philippi",
  "Nyanga", "Bonteheuwel", "Langa", "Mutual", "Ysterplaat",
  "Paarden Eiland", "Esplanade", "Cape Town",
];

// ── Coordinates ───────────────────────────────────────────────────────────────
const CL_COORDS: Record<string, [number, number]> = {
  "Chris Hani":     [-34.0512, 18.6935],
  "Khayelitsha":    [-34.0411, 18.6726],
  "Nonkqubela":     [-34.0448, 18.6851],
  "Nolungile":      [-34.0380, 18.6782],
  "Mandalay":       [-34.0198, 18.6578],
  "Stock Road":     [-34.0089, 18.6421],
  "Philippi":       [-33.9981, 18.5896],
  "Nyanga":         [-33.9851, 18.5556],
  "Bonteheuwel":    [-33.9712, 18.5489],
  "Langa":          [-33.9491, 18.5259],
  "Mutual":         [-33.9099, 18.5302],
  "Ysterplaat":     [-33.9021, 18.4912],
  "Paarden Eiland": [-33.9118, 18.4731],
  "Esplanade":      [-33.9195, 18.4431],
  "Cape Town":      [-33.9258, 18.4232],
};

// ── Route 1: Chris Hani → Cape Town — 9 trains ───────────────────────────────
// Departure times from Chris Hani; each subsequent stop +~5 min avg spacing
// Train numbers: 9900 9400 9902 9904 9906 9908 9910 9912 9914
const CH_DOWN_TRAINS = ["9900","9400","9902","9904","9906","9908","9910","9912","9914"];
// Per-stop departure times for each train (null = skip)
const CH_DOWN_TIMES: Record<string, (string | null)[]> = {
  "Chris Hani":     ["05:06","06:23","07:41","08:53","10:33","11:56","13:17","15:13","16:36"],
  "Khayelitsha":    ["05:10","06:27","07:45","08:57","10:37","12:00","13:21","15:17","16:40"],
  "Nonkqubela":     ["05:13","06:30","07:48","09:00","10:40","12:03","13:24","15:20","16:43"],
  "Nolungile":      ["05:16","06:33","07:51","09:03","10:43","12:06","13:27","15:23","16:46"],
  "Mandalay":       ["05:20","06:37","07:55","09:07","10:47","12:10","13:31","15:27","16:50"],
  "Stock Road":     ["05:24","06:41","07:59","09:11","10:51","12:14","13:35","15:31","16:54"],
  "Philippi":       ["05:29","06:46","08:04","09:16","10:56","12:19","13:40","15:36","16:59"],
  "Nyanga":         ["05:34","06:51","08:09","09:21","11:01","12:24","13:45","15:41","17:04"],
  "Bonteheuwel":    ["05:38","06:55","08:13","09:25","11:05","12:28","13:49","15:45","17:08"],
  "Langa":          ["05:43","07:00","08:18","09:30","11:10","12:33","13:54","15:50","17:13"],
  "Mutual":         ["05:50","07:07","08:25","09:37","11:17","12:40","14:01","15:57","17:20"],
  "Ysterplaat":     ["05:55","07:12","08:30","09:42","11:22","12:45","14:06","16:02","17:25"],
  "Paarden Eiland": ["05:59","07:16","08:34","09:46","11:26","12:49","14:10","16:06","17:29"],
  "Esplanade":      ["06:03","07:20","08:38","09:50","11:30","12:53","14:14","16:10","17:33"],
  "Cape Town":      ["06:08","07:25","08:43","09:55","11:35","12:58","14:19","16:15","17:38"],
};

// ── Route 1 return: Cape Town → Chris Hani (odd numbers) ─────────────────────
const CH_UP_TRAINS = ["9901","9401","9903","9905","9907","9909","9911","9913","9915"];
const CH_UP_TIMES: Record<string, (string | null)[]> = {
  "Cape Town":      ["05:30","06:45","08:00","09:15","11:00","12:20","13:45","15:30","16:50"],
  "Esplanade":      ["05:33","06:48","08:03","09:18","11:03","12:23","13:48","15:33","16:53"],
  "Paarden Eiland": ["05:37","06:52","08:07","09:22","11:07","12:27","13:52","15:37","16:57"],
  "Ysterplaat":     ["05:41","06:56","08:11","09:26","11:11","12:31","13:56","15:41","17:01"],
  "Mutual":         ["05:46","07:01","08:16","09:31","11:16","12:36","14:01","15:46","17:06"],
  "Langa":          ["05:53","07:08","08:23","09:38","11:23","12:43","14:08","15:53","17:13"],
  "Bonteheuwel":    ["05:58","07:13","08:28","09:43","11:28","12:48","14:13","15:58","17:18"],
  "Nyanga":         ["06:02","07:17","08:32","09:47","11:32","12:52","14:17","16:02","17:22"],
  "Philippi":       ["06:07","07:22","08:37","09:52","11:37","12:57","14:22","16:07","17:27"],
  "Stock Road":     ["06:12","07:27","08:42","09:57","11:42","13:02","14:27","16:12","17:32"],
  "Mandalay":       ["06:16","07:31","08:46","10:01","11:46","13:06","14:31","16:16","17:36"],
  "Nolungile":      ["06:20","07:35","08:50","10:05","11:50","13:10","14:35","16:20","17:40"],
  "Nonkqubela":     ["06:23","07:38","08:53","10:08","11:53","13:13","14:38","16:23","17:43"],
  "Khayelitsha":    ["06:26","07:41","08:56","10:11","11:56","13:16","14:41","16:26","17:46"],
  "Chris Hani":     ["06:30","07:45","09:00","10:15","12:00","13:20","14:45","16:30","17:50"],
};

// ── Route 2: Nonkqubela → Chris Hani (Mon–Fri) ───────────────────────────────
const NQ_UP_WD_TRAINS    = ["9901","9903","9905","9907","9909","9911","9913","9915","9917"];
const NQ_UP_WD_PLATFORMS = [    1,     1,     1,     1,     1,     1,     1,     1,     1];
const NQ_UP_WD_TIMES: Record<string, (string | null)[]> = {
  "Nonkqubela": ["05:53","07:08","08:23","10:03","11:23","12:47","14:48","16:03","17:18"],
  "Nolungile":  ["05:56","07:11","08:26","10:06","11:26","12:50","14:51","16:06","17:21"],
  "Khayelitsha":["05:59","07:14","08:29","10:09","11:29","12:53","14:54","16:09","17:24"],
  "Chris Hani": ["06:03","07:18","08:33","10:13","11:33","12:57","14:58","16:13","17:28"],
};

// ── Route 2: Nonkqubela → Chris Hani (Saturday) ───────────────────────────────
const NQ_UP_SAT_TRAINS = ["9901","9903","9905","9907","9909","9911","9913"];
const NQ_UP_SAT_TIMES: Record<string, (string | null)[]> = {
  "Nonkqubela": ["06:22","07:38","09:01","10:18","11:38","13:58","14:00"],
  "Nolungile":  ["06:25","07:41","09:04","10:21","11:41","14:01","14:03"],
  "Khayelitsha":["06:28","07:44","09:07","10:24","11:44","14:04","14:06"],
  "Chris Hani": ["06:32","07:48","09:11","10:28","11:48","14:08","14:10"],
};

// ── Route 3: Nonkqubela → Cape Town ──────────────────────────────────────────
const NQ_DOWN_TRAINS = ["9900","9902","9904","9906","9908","9910","9912","9914","9916","9918","9920"];
const NQ_DOWN_TIMES: Record<string, (string | null)[]> = {
  "Nonkqubela":     ["05:06","06:23","07:41","08:53","10:33","11:56","13:17","15:13","16:36","17:51","19:21"],
  "Nolungile":      ["05:09","06:26","07:44","08:56","10:36","11:59","13:20","15:16","16:39","17:54","19:24"],
  "Mandalay":       ["05:13","06:30","07:48","09:00","10:40","12:03","13:24","15:20","16:43","17:58","19:28"],
  "Stock Road":     ["05:17","06:34","07:52","09:04","10:44","12:07","13:28","15:24","16:47","18:02","19:32"],
  "Philippi":       ["05:22","06:39","07:57","09:09","10:49","12:12","13:33","15:29","16:52","18:07","19:37"],
  "Nyanga":         ["05:27","06:44","08:02","09:14","10:54","12:17","13:38","15:34","16:57","18:12","19:42"],
  "Bonteheuwel":    ["05:31","06:48","08:06","09:18","10:58","12:21","13:42","15:38","17:01","18:16","19:46"],
  "Langa":          ["05:36","06:53","08:11","09:23","11:03","12:26","13:47","15:43","17:06","18:21","19:51"],
  "Mutual":         ["05:43","07:00","08:18","09:30","11:10","12:33","13:54","15:50","17:13","18:28","19:58"],
  "Ysterplaat":     ["05:48","07:05","08:23","09:35","11:15","12:38","13:59","15:55","17:18","18:33","20:03"],
  "Paarden Eiland": ["05:52","07:09","08:27","09:39","11:19","12:42","14:03","15:59","17:22","18:37","20:07"],
  "Esplanade":      ["05:56","07:13","08:31","09:43","11:23","12:46","14:07","16:03","17:26","18:41","20:11"],
  "Cape Town":      ["06:01","07:18","08:36","09:48","11:28","12:51","14:12","16:08","17:31","18:46","20:16"],
};

async function seedCentralLine() {
  console.log("\nSeeding Central Line timetable...");

  const allRouteIds = [
    CL_CHRIS_HANI_DOWN, CL_CHRIS_HANI_UP,
    CL_NONKQUBELA_UP, CL_NONKQUBELA_UP_SAT, CL_NONKQUBELA_DOWN,
  ];

  // ── Routes ─────────────────────────────────────────────────────────────────
  const { error: rErr } = await sb.from("prasa_routes").upsert([
    { id: CL_CHRIS_HANI_DOWN,   line_name: "Central Line", direction: "down", from_station: "Chris Hani",  to_station: "Cape Town",  days_of_operation: "Mon-Sat" },
    { id: CL_CHRIS_HANI_UP,     line_name: "Central Line", direction: "up",   from_station: "Cape Town",   to_station: "Chris Hani", days_of_operation: "Mon-Sat" },
    { id: CL_NONKQUBELA_UP,     line_name: "Central Line", direction: "up",   from_station: "Nonkqubela", to_station: "Chris Hani", days_of_operation: "Mon-Fri" },
    { id: CL_NONKQUBELA_UP_SAT, line_name: "Central Line", direction: "up",   from_station: "Nonkqubela", to_station: "Chris Hani", days_of_operation: "Saturday" },
    { id: CL_NONKQUBELA_DOWN,   line_name: "Central Line", direction: "down", from_station: "Nonkqubela", to_station: "Cape Town",  days_of_operation: "Mon-Sat" },
  ], { onConflict: "id" });
  if (rErr) { console.error("Central Line routes error:", rErr.message); return; }
  console.log("Central Line routes upserted.");

  // ── Stations ───────────────────────────────────────────────────────────────
  await sb.from("prasa_stations").delete().in("route_id", allRouteIds);

  const stationRows: object[] = [
    ...CL_STOPS_CH_DOWN.map((s, i) => ({
      route_id: CL_CHRIS_HANI_DOWN, station_name: s, stop_order: i + 1,
      lat: CL_COORDS[s]?.[0] ?? null, lng: CL_COORDS[s]?.[1] ?? null,
    })),
    ...CL_STOPS_CH_UP.map((s, i) => ({
      route_id: CL_CHRIS_HANI_UP, station_name: s, stop_order: i + 1,
      lat: CL_COORDS[s]?.[0] ?? null, lng: CL_COORDS[s]?.[1] ?? null,
    })),
    ...CL_STOPS_NQ_UP.map((s, i) => ({
      route_id: CL_NONKQUBELA_UP, station_name: s, stop_order: i + 1,
      lat: CL_COORDS[s]?.[0] ?? null, lng: CL_COORDS[s]?.[1] ?? null,
    })),
    ...CL_STOPS_NQ_UP.map((s, i) => ({
      route_id: CL_NONKQUBELA_UP_SAT, station_name: s, stop_order: i + 1,
      lat: CL_COORDS[s]?.[0] ?? null, lng: CL_COORDS[s]?.[1] ?? null,
    })),
    ...CL_STOPS_NQ_DOWN.map((s, i) => ({
      route_id: CL_NONKQUBELA_DOWN, station_name: s, stop_order: i + 1,
      lat: CL_COORDS[s]?.[0] ?? null, lng: CL_COORDS[s]?.[1] ?? null,
    })),
  ];

  const { error: sErr } = await sb.from("prasa_stations").insert(stationRows);
  if (sErr) { console.error("Central Line stations error:", sErr.message); return; }
  console.log(`Central Line stations inserted: ${stationRows.length} rows.`);

  // ── Timetable ──────────────────────────────────────────────────────────────
  await sb.from("prasa_timetable").delete().in("route_id", allRouteIds);

  const ttRows: object[] = [];

  function pushRows(
    routeId: string,
    stops: string[],
    trains: string[],
    times: Record<string, (string | null)[]>,
    platforms: (string | null)[] | null = null,
  ) {
    for (const [si, station] of stops.entries()) {
      const stopTimes = times[station] ?? [];
      for (const [ti, trainNo] of trains.entries()) {
        const dep = stopTimes[ti];
        if (!dep) continue;
        ttRows.push({
          route_id: routeId,
          train_no: trainNo,
          station_name: station,
          stop_order: si + 1,
          departure: dep,
          platform: platforms ? (platforms[ti] ?? null) : null,
        });
      }
    }
  }

  pushRows(CL_CHRIS_HANI_DOWN,   CL_STOPS_CH_DOWN,  CH_DOWN_TRAINS,      CH_DOWN_TIMES);
  pushRows(CL_CHRIS_HANI_UP,     CL_STOPS_CH_UP,    CH_UP_TRAINS,        CH_UP_TIMES);
  pushRows(CL_NONKQUBELA_UP,     CL_STOPS_NQ_UP,    NQ_UP_WD_TRAINS,     NQ_UP_WD_TIMES, NQ_UP_WD_PLATFORMS.map(String));
  pushRows(CL_NONKQUBELA_UP_SAT, CL_STOPS_NQ_UP,    NQ_UP_SAT_TRAINS,    NQ_UP_SAT_TIMES);
  pushRows(CL_NONKQUBELA_DOWN,   CL_STOPS_NQ_DOWN,  NQ_DOWN_TRAINS,      NQ_DOWN_TIMES);

  const { error: tErr2 } = await sb.from("prasa_timetable").insert(ttRows);
  if (tErr2) { console.error("Central Line timetable error:", tErr2.message); return; }
  console.log(`Central Line timetable inserted: ${ttRows.length} stop-time rows.`);
  console.log("Central Line seed done.");
}

async function main() {
  await seed();
  await seedCentralLine();
}

main().catch(console.error);

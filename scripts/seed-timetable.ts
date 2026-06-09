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

seed().catch(console.error);

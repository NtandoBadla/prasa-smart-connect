import { Router } from "express";
import { supabase } from "../db";
import { requireAuth } from "../middleware/auth";

const router = Router();

function toMins(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// ── GET /api/timetable/search?from=X&to=Y&time=HH:mm ─────────────────────────
router.get("/search", async (req, res) => {
  const { from, to, time } = req.query as { from?: string; to?: string; time?: string };
  if (!from || !to) { res.status(400).json({ error: "from and to required" }); return; }

  const [{ data: fromStops }, { data: toStops }] = await Promise.all([
    supabase.from("prasa_timetable").select("route_id, train_no, stop_order, departure, platform").ilike("station_name", from).not("departure", "is", null),
    supabase.from("prasa_timetable").select("route_id, train_no, stop_order, departure, platform").ilike("station_name", to).not("departure", "is", null),
  ]);

  if (!fromStops?.length || !toStops?.length) { res.json([]); return; }

  const results: {
    train_no: string; route_id: string;
    from_station: string; to_station: string;
    departure: string; arrival: string;
    duration_min: number;
    platform: string | null;
  }[] = [];

  for (const f of fromStops) {
    const match = toStops.find(
      (t) => t.route_id === f.route_id && t.train_no === f.train_no && t.stop_order > f.stop_order
    );
    if (!match || !f.departure || !match.departure) continue;
    results.push({
      train_no: f.train_no, route_id: f.route_id,
      from_station: from, to_station: to,
      departure: f.departure, arrival: match.departure,
      duration_min: toMins(match.departure) - toMins(f.departure),
      platform: f.platform ?? null,
    });
  }

  results.sort((a, b) => a.departure.localeCompare(b.departure));
  const filtered = time ? results.filter((r) => r.departure >= time) : results;
  res.json(filtered.length > 0 ? filtered : results);
});

// ── GET /api/timetable/train/by-route/:routeId ───────────────────────────────
router.get("/train/by-route/:routeId", async (req, res) => {
  const { data, error } = await supabase
    .from("prasa_timetable")
    .select("train_no, station_name, stop_order, departure, platform, route_id")
    .eq("route_id", req.params.routeId)
    .order("train_no", { ascending: true })
    .order("stop_order", { ascending: true });
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data ?? []);
});

// ── GET /api/timetable/train/:trainNo ─────────────────────────────────────────
router.get("/train/:trainNo", async (req, res) => {
  const { data, error } = await supabase
    .from("prasa_timetable")
    .select("station_name, stop_order, departure, platform, route_id")
    .eq("train_no", req.params.trainNo)
    .order("stop_order", { ascending: true });
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data ?? []);
});

// ── GET /api/timetable/routes ─────────────────────────────────────────────────
router.get("/routes", async (_req, res) => {
  const { data, error } = await supabase.from("prasa_routes").select("*").order("line_name");
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data ?? []);
});

// ── GET /api/timetable/stations/:routeId ─────────────────────────────────────
router.get("/stations/:routeId", async (req, res) => {
  const { data, error } = await supabase
    .from("prasa_stations")
    .select("station_name, stop_order, lat, lng")
    .eq("route_id", req.params.routeId)
    .order("stop_order", { ascending: true });
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data ?? []);
});

// ── GET /api/timetable/next?station=X&direction=down|up&line=central|stellenbosch ──────────────────────────
router.get("/next", async (req, res) => {
  const { station, direction, line, limit = "5" } = req.query as { station?: string; direction?: string; line?: string; limit?: string };
  if (!station) { res.status(400).json({ error: "station required" }); return; }

  let query = supabase
    .from("prasa_timetable")
    .select("train_no, route_id, stop_order, departure, station_name")
    .ilike("station_name", station)
    .not("departure", "is", null)
    .order("departure", { ascending: true })
    .limit(Number(limit));

  if (direction && line) {
    query = query.ilike("route_id", `${line}-%-${direction}`);
  } else if (direction) {
    // Support both stellenbosch and central line directions
    query = query.like("route_id", `%-${direction}%`);
  }

  const { data, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data ?? []);
});

// ── Admin: POST /api/timetable/admin/stop — upsert a stop time ───────────────
router.post("/admin/stop", requireAuth, async (req, res) => {
  const { route_id, train_no, station_name, stop_order, departure, platform } = req.body;
  if (!route_id || !train_no || !station_name) {
    res.status(400).json({ error: "route_id, train_no, station_name required" }); return;
  }
  const { data, error } = await supabase
    .from("prasa_timetable")
    .upsert({ route_id, train_no, station_name, stop_order, departure: departure || null, platform: platform || null },
             { onConflict: "route_id,train_no,station_name" })
    .select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

// ── Admin: POST /api/timetable/admin/route — create a new route ──────────────
router.post("/admin/route", requireAuth, async (req, res) => {
  const { id, line_name, direction, from_station, to_station, days_of_operation } = req.body;
  if (!id || !line_name || !from_station || !to_station) {
    res.status(400).json({ error: "id, line_name, from_station, to_station required" }); return;
  }
  const { data, error } = await supabase
    .from("prasa_routes")
    .upsert({ id, line_name, direction: direction || "down", from_station, to_station, days_of_operation: days_of_operation || "Mon-Fri" },
             { onConflict: "id" })
    .select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

// ── Admin: DELETE /api/timetable/admin/route/:routeId ───────────────────────
router.delete("/admin/route/:routeId", requireAuth, async (req, res) => {
  const { routeId } = req.params;
  // Delete timetable stops first, then stations, then route
  await supabase.from("prasa_timetable").delete().eq("route_id", routeId);
  await supabase.from("prasa_stations").delete().eq("route_id", routeId);
  const { error } = await supabase.from("prasa_routes").delete().eq("id", routeId);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

// ── Admin: POST /api/timetable/admin/bulk-stops — insert many stops at once ──
router.post("/admin/bulk-stops", requireAuth, async (req, res) => {
  const { route_id, stops } = req.body as {
    route_id: string;
    stops: { train_no: string; station_name: string; stop_order: number; departure: string | null; platform?: string | null }[];
  };
  if (!route_id || !Array.isArray(stops) || stops.length === 0) {
    res.status(400).json({ error: "route_id and stops[] required" }); return;
  }
  const rows = stops.map((s) => ({ ...s, route_id, departure: s.departure || null, platform: s.platform || null }));
  const { error } = await supabase.from("prasa_timetable").upsert(rows, { onConflict: "route_id,train_no,station_name" });
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ inserted: rows.length });
});

// ── Admin: DELETE /api/timetable/admin/train/:trainNo ────────────────────────
router.delete("/admin/train/:trainNo", requireAuth, async (req, res) => {
  const { error } = await supabase.from("prasa_timetable").delete().eq("train_no", req.params.trainNo);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

export default router;

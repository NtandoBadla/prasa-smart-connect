import serverless from "serverless-http";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { randomUUID, createHmac, timingSafeEqual } from "crypto";
import { supabase } from "../../server/db";

const isSupabaseConfigured =
  !!process.env.SUPABASE_URL &&
  !process.env.SUPABASE_URL.includes("REPLACE") &&
  !!process.env.SUPABASE_SERVICE_KEY &&
  !process.env.SUPABASE_SERVICE_KEY.includes("REPLACE");

import registerRouter   from "../../server/routes/register";
import subscribeRouter  from "../../server/routes/subscribe";
import adminUpdateRouter from "../../server/routes/adminUpdate";
import chatbotRouter    from "../../server/routes/chatbot";
import ticketsRouter    from "../../server/routes/tickets";
import sentimentRouter  from "../../server/routes/sentiment";
import lostFoundRouter  from "../../server/routes/lostFound";
import safetyRouter     from "../../server/routes/safety";

import { SCHEDULES as SEED_SCHEDULES, ALERTS as SEED_ALERTS } from "../../src/data/prasa";
import type { TrainSchedule, ServiceAlert } from "../../src/data/prasa";
import type { NewsItem } from "../../src/data/extras";

// Inline seed data — avoids esbuild issues with dynamic helper functions in prasa.ts
const SOUTHERN_DOWN = ["Cape Town","Woodstock","Salt River","Observatory","Mowbray","Rondebosch","Newlands","Claremont","Wynberg","Retreat","Muizenberg","Fish Hoek","Simon's Town"];
const SOUTHERN_UP   = [...SOUTHERN_DOWN].reverse();
const NORTHERN_DOWN = ["Cape Town","Woodstock","Salt River","Pinelands","Goodwood","Parow","Bellville","Stellenbosch"];
const NORTHERN_UP   = [...NORTHERN_DOWN].reverse();
const CENTRAL_DOWN  = ["Cape Town","Woodstock","Salt River","Langa","Nyanga","Philippi","Mitchells Plain","Khayelitsha"];
const CENTRAL_UP    = [...CENTRAL_DOWN].reverse();
const CF_DOWN = ["Cape Town","Salt River","Pinelands","Nyanga","Philippi","Retreat"];
const CF_UP   = [...CF_DOWN].reverse();

function addMin(t: string, m: number) {
  const [h, mm] = t.split(":").map(Number);
  const tot = h * 60 + mm + m;
  return `${String(Math.floor(tot / 60) % 24).padStart(2,"0")}:${String(tot % 60).padStart(2,"0")}`;
}
function mk(id: string, no: string, line: TrainSchedule["line"], stops: string[], dep: string, dur: number, plat: string, status: TrainSchedule["status"] = "On Time", delay?: number): TrainSchedule {
  const fares: Record<string,number> = {"Southern Line":14.5,"Northern Line":13,"Central Line":12.5,"Cape Flats Line":12};
  return { id, trainNo: no, line, from: stops[0], to: stops[stops.length-1], departure: dep, arrival: addMin(dep, dur), durationMin: dur, stops, status, delayMin: delay, platform: plat, fare: fares[line] };
}

let schedules: TrainSchedule[] = [
  mk("S1","0412","Southern Line",SOUTHERN_DOWN,"05:50",77,"11"),
  mk("S2","0428","Southern Line",SOUTHERN_DOWN,"06:30",77,"11"),
  mk("S3","0444","Southern Line",SOUTHERN_DOWN,"07:05",80,"12","Delayed",12),
  mk("S4","0460","Southern Line",SOUTHERN_DOWN,"08:00",77,"11"),
  mk("S5","0476","Southern Line",SOUTHERN_DOWN,"09:30",77,"11"),
  mk("S6","0492","Southern Line",SOUTHERN_DOWN,"12:00",77,"11"),
  mk("S7","0508","Southern Line",SOUTHERN_DOWN,"15:00",77,"11"),
  mk("S8","0524","Southern Line",SOUTHERN_DOWN,"17:00",80,"12"),
  mk("S9","0540","Southern Line",SOUTHERN_DOWN,"18:30",77,"11"),
  mk("S10","0413","Southern Line",SOUTHERN_UP,"05:00",77,"1"),
  mk("S11","0429","Southern Line",SOUTHERN_UP,"06:00",77,"1"),
  mk("S12","0445","Southern Line",SOUTHERN_UP,"07:10",80,"2"),
  mk("S13","0461","Southern Line",SOUTHERN_UP,"08:15",77,"1"),
  mk("S14","0477","Southern Line",SOUTHERN_UP,"10:00",77,"1"),
  mk("S15","0493","Southern Line",SOUTHERN_UP,"12:30",77,"1"),
  mk("S16","0516","Southern Line",SOUTHERN_UP,"16:42",78,"1"),
  mk("S17","0532","Southern Line",SOUTHERN_UP,"17:45",77,"2"),
  mk("S18","0548","Southern Line",SOUTHERN_UP,"19:00",77,"1"),
  mk("N1","1102","Northern Line",NORTHERN_DOWN,"05:45",65,"5"),
  mk("N2","1118","Northern Line",NORTHERN_DOWN,"06:30",65,"5"),
  mk("N3","1134","Northern Line",NORTHERN_DOWN,"07:15",65,"6"),
  mk("N4","1150","Northern Line",NORTHERN_DOWN,"08:00",65,"5"),
  mk("N5","1166","Northern Line",NORTHERN_DOWN,"09:00",65,"5"),
  mk("N6","1182","Northern Line",NORTHERN_DOWN,"12:00",65,"5"),
  mk("N7","1198","Northern Line",NORTHERN_DOWN,"15:00",65,"5"),
  mk("N8","1206","Northern Line",NORTHERN_DOWN,"17:15",65,"—","Cancelled"),
  mk("N9","1214","Northern Line",NORTHERN_DOWN,"18:00",65,"6"),
  mk("N10","1103","Northern Line",NORTHERN_UP,"05:00",65,"2"),
  mk("N11","1119","Northern Line",NORTHERN_UP,"06:00",65,"2"),
  mk("N12","1124","Northern Line",NORTHERN_UP,"07:10",65,"2"),
  mk("N13","1135","Northern Line",NORTHERN_UP,"08:00",65,"3"),
  mk("N14","1151","Northern Line",NORTHERN_UP,"09:30",65,"2"),
  mk("N15","1167","Northern Line",NORTHERN_UP,"12:30",65,"2"),
  mk("N16","1183","Northern Line",NORTHERN_UP,"15:30",65,"2"),
  mk("N17","1199","Northern Line",NORTHERN_UP,"17:00",65,"3"),
  mk("N18","1215","Northern Line",NORTHERN_UP,"18:30",65,"2"),
  mk("C1","2208","Central Line",CENTRAL_DOWN,"05:30",70,"8"),
  mk("C2","2224","Central Line",CENTRAL_DOWN,"06:45",70,"8","Delayed",18),
  mk("C3","2240","Central Line",CENTRAL_DOWN,"07:30",70,"8"),
  mk("C4","2256","Central Line",CENTRAL_DOWN,"08:30",70,"8"),
  mk("C5","2272","Central Line",CENTRAL_DOWN,"10:00",70,"8"),
  mk("C6","2288","Central Line",CENTRAL_DOWN,"12:00",70,"8"),
  mk("C7","2304","Central Line",CENTRAL_DOWN,"15:00",70,"8"),
  mk("C8","2320","Central Line",CENTRAL_DOWN,"17:00",70,"8"),
  mk("C9","2336","Central Line",CENTRAL_DOWN,"18:30",70,"8"),
  mk("C10","2209","Central Line",CENTRAL_UP,"05:00",70,"4"),
  mk("C11","2225","Central Line",CENTRAL_UP,"06:00",70,"4"),
  mk("C12","2241","Central Line",CENTRAL_UP,"07:00",70,"4"),
  mk("C13","2257","Central Line",CENTRAL_UP,"08:00",70,"4"),
  mk("C14","2273","Central Line",CENTRAL_UP,"09:30",70,"4"),
  mk("C15","2289","Central Line",CENTRAL_UP,"12:30",70,"4"),
  mk("C16","2305","Central Line",CENTRAL_UP,"15:30",70,"4"),
  mk("C17","2321","Central Line",CENTRAL_UP,"17:00",70,"4"),
  mk("C18","2337","Central Line",CENTRAL_UP,"18:30",70,"4"),
  mk("F1","3102","Cape Flats Line",CF_DOWN,"06:00",58,"9"),
  mk("F2","3118","Cape Flats Line",CF_DOWN,"07:20",58,"9"),
  mk("F3","3134","Cape Flats Line",CF_DOWN,"08:30",58,"9"),
  mk("F4","3150","Cape Flats Line",CF_DOWN,"12:00",58,"9"),
  mk("F5","3166","Cape Flats Line",CF_DOWN,"17:00",58,"9"),
  mk("F6","3182","Cape Flats Line",CF_DOWN,"18:30",58,"9"),
  mk("F7","3103","Cape Flats Line",CF_UP,"05:30",58,"7"),
  mk("F8","3119","Cape Flats Line",CF_UP,"06:30",58,"7"),
  mk("F9","3135","Cape Flats Line",CF_UP,"07:45",58,"7"),
  mk("F10","3151","Cape Flats Line",CF_UP,"12:30",58,"7"),
  mk("F11","3167","Cape Flats Line",CF_UP,"17:30",58,"7"),
  mk("F12","3183","Cape Flats Line",CF_UP,"19:00",58,"7"),
];

let alerts: ServiceAlert[] = [
  { id:"a1", level:"critical", title:"Northern Line: Train 1206 cancelled", message:"The 17:15 from Cape Town to Stellenbosch is cancelled due to signal failure. Next service at 18:00.", line:"Northern Line", postedAt:"2025-04-24T14:10:00Z" },
  { id:"a2", level:"warning",  title:"Central Line delays of up to 20 minutes", message:"Cable theft between Langa and Nyanga is causing delays. Maintenance teams on site.", line:"Central Line", postedAt:"2025-04-24T12:30:00Z" },
  { id:"a3", level:"info",     title:"Southern Line weekend works", message:"Engineering work between Muizenberg and Fish Hoek this Sunday from 06:00 to 14:00. Bus shuttles in operation.", line:"Southern Line", postedAt:"2025-04-23T09:00:00Z" },
];

let news: NewsItem[] = [
  { id: "n1", title: "Central Line returns to full service after upgrade", excerpt: "Following extensive infrastructure rehabilitation, Metrorail Central Line trains now operate at full capacity between Cape Town and Khayelitsha.", category: "Network", date: "2025-04-22" },
  { id: "n2", title: "PRASA invests R450m in new signalling for Western Cape", excerpt: "A new digital signalling programme will improve safety, reduce delays and increase frequency on Southern and Northern lines.", category: "Upgrade", date: "2025-04-15" },
  { id: "n3", title: "Free travel for matric pupils on exam days", excerpt: "Grade 12 learners can travel free on Metrorail services on presentation of their exam admission letter at any station.", category: "Community", date: "2025-04-08" },
  { id: "n4", title: "Statement on weekend Southern Line works", excerpt: "Engineering teams will be on site this weekend at Muizenberg. Bus shuttles will be deployed between Muizenberg and Fish Hoek.", category: "Press", date: "2025-04-04" },
];

const app = express();
app.use(cors({ origin: "*", credentials: false }));
app.use(express.json());

// ── JWT-style token auth (stateless — survives cold starts on Netlify) ─────────
const ADMIN_USER = process.env.ADMIN_USER ?? "admin";
const ADMIN_PASS = process.env.ADMIN_PASS ?? "prasa2025";
// Secret used to sign tokens — set ADMIN_JWT_SECRET in Netlify env vars
const JWT_SECRET = process.env.ADMIN_JWT_SECRET ?? "prasa-secret-change-me";

function signToken(payload: string): string {
  const sig = createHmac("sha256", JWT_SECRET).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function verifyToken(token: string): boolean {
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return false;
  const payload = token.slice(0, lastDot);
  const sig     = token.slice(lastDot + 1);
  const expected = createHmac("sha256", JWT_SECRET).update(payload).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["x-admin-token"] as string | undefined;
  if (!token || !verifyToken(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post(["/api/admin/login", "/admin/login"], (req, res) => {
  const { username, password } = req.body as { username: string; password: string };
  if (!username || !password) { res.status(400).json({ error: "Username and password required" }); return; }
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    // Token payload: uuid + issued-at so each token is unique
    const token = signToken(`${randomUUID()}.${Date.now()}`);
    res.json({ token });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

app.post(["/api/admin/logout", "/admin/logout"], (_req, res) => {
  // Stateless — client just discards the token
  res.json({ ok: true });
});

// ── Public data ───────────────────────────────────────────────────────────────
app.get(["/api/schedules", "/schedules"], (_req, res) => res.json(schedules));
app.get(["/api/alerts",   "/alerts"],    (_req, res) => res.json(alerts));
app.get(["/api/news",     "/news"],      (_req, res) => res.json(news));

// ── Modular routes ────────────────────────────────────────────────────────────
app.use(["/api/register",      "/register"],      registerRouter);
app.use(["/api/subscribe",     "/subscribe"],     subscribeRouter);
app.use(["/api/admin/update",  "/admin/update"],  requireAuth, adminUpdateRouter);
app.use(["/api/chatbot",       "/chatbot"],       chatbotRouter);
app.use(["/api/tickets",       "/tickets"],       ticketsRouter);
app.use(["/api/sentiment",     "/sentiment"],     sentimentRouter);
app.use(["/api/lost-found",    "/lost-found"],    lostFoundRouter);
app.use(["/api/safety",        "/safety"],        safetyRouter);

// Admin-only: safety incidents
app.get(["/api/admin/safety", "/admin/safety"], requireAuth, async (_req, res) => {
  if (!isSupabaseConfigured) { res.json([]); return; }
  const { data, error } = await supabase
    .from("safety_incidents")
    .select("id, type, station, details, status, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Safety fetch error:", error.message);
    res.status(500).json({ error: "Failed to fetch safety incidents" });
    return;
  }
  res.json(data ?? []);
});
app.patch(["/api/admin/safety/:id", "/admin/safety/:id"], requireAuth, async (req, res) => {
  if (!isSupabaseConfigured) { res.status(503).json({ error: "Database not configured" }); return; }
  const { status } = req.body as { status: string };
  if (!status) { res.status(400).json({ error: "status is required" }); return; }
  const { data, error } = await supabase
    .from("safety_incidents")
    .update({ status })
    .eq("id", req.params.id)
    .select("id, type, station, details, status, created_at")
    .single();
  if (error) {
    console.error("Safety update error:", error.message);
    res.status(500).json({ error: "Failed to update incident" });
    return;
  }
  res.json(data);
});

// ── Admin: Schedules ──────────────────────────────────────────────────────────
app.post(["/api/admin/schedules", "/admin/schedules"], requireAuth, (req, res) => {
  const item: TrainSchedule = { ...req.body, id: randomUUID() };
  schedules.push(item); res.status(201).json(item);
});
app.put(["/api/admin/schedules/:id", "/admin/schedules/:id"], requireAuth, (req, res) => {
  const idx = schedules.findIndex((s) => s.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: "Not found" }); return; }
  schedules[idx] = { ...schedules[idx], ...req.body, id: req.params.id };
  res.json(schedules[idx]);
});
app.delete(["/api/admin/schedules/:id", "/admin/schedules/:id"], requireAuth, (req, res) => {
  schedules = schedules.filter((s) => s.id !== req.params.id);
  res.json({ ok: true });
});

// ── Admin: Alerts ─────────────────────────────────────────────────────────────
app.post(["/api/admin/alerts", "/admin/alerts"], requireAuth, (req, res) => {
  const item: ServiceAlert = { ...req.body, id: randomUUID(), postedAt: new Date().toISOString() };
  alerts.unshift(item); res.status(201).json(item);
});
app.put(["/api/admin/alerts/:id", "/admin/alerts/:id"], requireAuth, (req, res) => {
  const idx = alerts.findIndex((a) => a.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: "Not found" }); return; }
  alerts[idx] = { ...alerts[idx], ...req.body, id: req.params.id };
  res.json(alerts[idx]);
});
app.delete(["/api/admin/alerts/:id", "/admin/alerts/:id"], requireAuth, (req, res) => {
  alerts = alerts.filter((a) => a.id !== req.params.id);
  res.json({ ok: true });
});

// ── Admin: News ───────────────────────────────────────────────────────────────
app.post(["/api/admin/news", "/admin/news"], requireAuth, (req, res) => {
  const item: NewsItem = { ...req.body, id: randomUUID() };
  news.unshift(item); res.status(201).json(item);
});
app.put(["/api/admin/news/:id", "/admin/news/:id"], requireAuth, (req, res) => {
  const idx = news.findIndex((n) => n.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: "Not found" }); return; }
  news[idx] = { ...news[idx], ...req.body, id: req.params.id };
  res.json(news[idx]);
});
app.delete(["/api/admin/news/:id", "/admin/news/:id"], requireAuth, (req, res) => {
  news = news.filter((n) => n.id !== req.params.id);
  res.json({ ok: true });
});

// ── Health ────────────────────────────────────────────────────────────────────
app.get(["/api/health", "/health"], (_req, res) => {
  res.json({
    status: "ok",
    supabase: isSupabaseConfigured ? "connected" : "not configured",
    emailjs: !!process.env.EMAILJS_SERVICE_ID && !process.env.EMAILJS_SERVICE_ID.includes("REPLACE") ? "configured" : "not configured",
    serpapi: !!process.env.SERPAPI_KEY && !process.env.SERPAPI_KEY.includes("REPLACE") ? "configured" : "not configured",
    openai:  !!process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes("REPLACE") ? "configured" : "not configured",
  });
});

// ── Admin: Subscribers ────────────────────────────────────────────────────────
app.get(["/api/admin/subscribers", "/admin/subscribers"], requireAuth, async (_req, res) => {
  if (!isSupabaseConfigured) { res.json([]); return; }
  const { data, error } = await supabase.from("users").select("id, email, station, created_at").order("created_at", { ascending: false });
  if (error) { res.status(500).json({ error: "Failed to fetch subscribers" }); return; }
  res.json(data ?? []);
});

// ── Stats ─────────────────────────────────────────────────────────────────────
app.get(["/api/admin/stats", "/admin/stats"], requireAuth, async (_req, res) => {
  let totalSubscribers = 0;
  if (isSupabaseConfigured) {
    const { count } = await supabase.from("users").select("*", { count: "exact", head: true });
    totalSubscribers = count ?? 0;
  }
  res.json({
    totalSchedules: schedules.length,
    onTime:         schedules.filter((s) => s.status === "On Time").length,
    delayed:        schedules.filter((s) => s.status === "Delayed").length,
    cancelled:      schedules.filter((s) => s.status === "Cancelled").length,
    totalAlerts:    alerts.length,
    criticalAlerts: alerts.filter((a) => a.level === "critical").length,
    totalNews:      news.length,
    totalSubscribers,
  });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

export const handler = serverless(app);

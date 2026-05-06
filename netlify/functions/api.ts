import serverless from "serverless-http";
import "dotenv/config";
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

let schedules: TrainSchedule[] = [...SEED_SCHEDULES];
let alerts: ServiceAlert[]     = [...SEED_ALERTS];

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

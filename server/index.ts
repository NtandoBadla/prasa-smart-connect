import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { randomUUID, createHmac, timingSafeEqual } from "crypto";
import cron from "node-cron";
import { supabase } from "./db";
import { runScrape } from "./scraper";
import { sendEmail } from "./mailer";
import { requireAuth } from "./middleware/auth";
import { runAutoNotify } from "./autoNotify";

const isSupabaseConfigured = () =>
  !!process.env.SUPABASE_URL &&
  !process.env.SUPABASE_URL.includes("REPLACE") &&
  !!process.env.SUPABASE_SERVICE_KEY &&
  !process.env.SUPABASE_SERVICE_KEY.includes("REPLACE");

import registerRouter from "./routes/register";
import subscribeRouter from "./routes/subscribe";
import adminUpdateRouter from "./routes/adminUpdate";
import chatbotRouter from "./routes/chatbot";
import ticketsRouter from "./routes/tickets";
import sentimentRouter from "./routes/sentiment";
import lostFoundRouter from "./routes/lostFound";
import safetyRouter from "./routes/safety";
import stationSearchRouter from "./routes/stationSearch";
import timetableRouter from "./routes/timetable";

import { SCHEDULES as SEED_SCHEDULES, ALERTS as SEED_ALERTS } from "../src/data/prasa";
import type { TrainSchedule, ServiceAlert } from "../src/data/prasa";
import type { NewsItem } from "../src/data/extras";

let schedules: TrainSchedule[] = [...SEED_SCHEDULES];
let alerts: ServiceAlert[]     = [...SEED_ALERTS];

let news: NewsItem[] = [
  { id: "n1", title: "Central Line returns to full service after upgrade", excerpt: "Following extensive infrastructure rehabilitation, Metrorail Central Line trains now operate at full capacity between Cape Town and Khayelitsha.", category: "Network", date: "2025-04-22" },
  { id: "n2", title: "PRASA invests R450m in new signalling for Western Cape", excerpt: "A new digital signalling programme will improve safety, reduce delays and increase frequency on Southern and Northern lines.", category: "Upgrade", date: "2025-04-15" },
  { id: "n3", title: "Free travel for matric pupils on exam days", excerpt: "Grade 12 learners can travel free on Metrorail services on presentation of their exam admission letter at any station.", category: "Community", date: "2025-04-08" },
  { id: "n4", title: "Statement on weekend Southern Line works", excerpt: "Engineering teams will be on site this weekend at Muizenberg. Bus shuttles will be deployed between Muizenberg and Fish Hoek.", category: "Press", date: "2025-04-04" },
];

const app = express();
app.use(cors({ origin: (origin, cb) => cb(null, true), credentials: true }));
app.use(express.json());

const ADMIN_USER = process.env.ADMIN_USER ?? "admin";
const ADMIN_PASS = process.env.ADMIN_PASS ?? "prasa2025";
const JWT_SECRET = process.env.ADMIN_JWT_SECRET ?? "prasa-secret-change-me";

function signToken(payload: string): string {
  const sig = createHmac("sha256", JWT_SECRET).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function verifyToken(token: string): boolean {
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return false;
  const payload  = token.slice(0, lastDot);
  const sig      = token.slice(lastDot + 1);
  const expected = createHmac("sha256", JWT_SECRET).update(payload).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body as { username: string; password: string };
  if (!username || !password) { res.status(400).json({ error: "Username and password required" }); return; }
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    res.json({ token: signToken(`${randomUUID()}.${Date.now()}`) });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

app.post("/api/admin/logout", (_req, res) => res.json({ ok: true }));

app.get("/api/schedules", (_req, res) => res.json(schedules));
app.get("/api/alerts",   (_req, res) => res.json(alerts));
app.get("/api/news",     (_req, res) => res.json(news));

app.use("/api/register",     registerRouter);
app.use("/api/subscribe",    subscribeRouter);
app.use("/api/admin/update", requireAuth, adminUpdateRouter);
app.use("/api/chatbot",      chatbotRouter);
app.use("/api/tickets",      ticketsRouter);

// ── Admin ticket recovery (auth-protected) ───────────────────────────────────────────────
app.get("/api/admin/tickets",               requireAuth, async (req, res) => {
  const { q, status, line } = req.query as { q?: string; status?: string; line?: string };
  let query = supabase.from("tickets")
    .select("id, ticket_ref, qr_token, user_id, passenger_name, id_number, phone, email, train_no, line, from_station, to_station, departure, arrival, fare, travel_class, payment_intent_id, payment_status, used, used_at, booked_at")
    .order("booked_at", { ascending: false }).limit(200);
  if (status) query = query.eq("payment_status", status);
  if (line)   query = query.eq("line", line);
  const { data, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }
  let results = data ?? [];
  if (q) {
    const lower = q.toLowerCase();
    results = results.filter((t: any) =>
      [t.ticket_ref, t.passenger_name, t.id_number, t.email, t.phone,
       t.payment_intent_id, t.train_no].some((v) => v && String(v).toLowerCase().includes(lower))
    );
  }
  res.json(results);
});

app.post("/api/admin/tickets/reissue",       requireAuth, async (req, res) => {
  const { ticketId, channels } = req.body as { ticketId: string; channels: ("email" | "sms")[] };
  if (!ticketId || !channels?.length) { res.status(400).json({ error: "ticketId and channels required" }); return; }
  const TICKET_SELECT = "id, ticket_ref, qr_token, user_id, passenger_name, id_number, phone, email, train_no, line, from_station, to_station, departure, arrival, fare, travel_class, payment_intent_id, payment_status, used, used_at, booked_at";
  const { data: ticket, error: fetchErr } = await supabase.from("tickets").select(TICKET_SELECT).eq("id", ticketId).single();
  if (fetchErr || !ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const results: { channel: string; status: string; error?: string }[] = [];

  if (channels.includes("email") && ticket.email) {
    try {
      await sendEmail({
        to: ticket.email,
        subject: `Your PRASA Ticket - ${ticket.ticket_ref}`,
        html: "",
        templateId: process.env.EMAILJS_TEMPLATE_ID,
        templateParams: {
          to_email: ticket.email,
          ticket_ref: ticket.ticket_ref,
          passenger_name: ticket.passenger_name ?? "Passenger",
          train_no: ticket.train_no,
          line: ticket.line,
          from_station: ticket.from_station,
          to_station: ticket.to_station,
          departure: ticket.departure,
          arrival: ticket.arrival ?? "-",
          fare: `R${Number(ticket.fare).toFixed(2)}`,
          travel_class: ticket.travel_class,
          payment_status: ticket.payment_status.toUpperCase(),
          booked_at: new Date(ticket.booked_at).toLocaleString("en-ZA"),
        },
      });
      results.push({ channel: "email", status: "sent" });
    } catch (err: any) { results.push({ channel: "email", status: "failed", error: err.message }); }
  } else if (channels.includes("email")) {
    results.push({ channel: "email", status: "skipped", error: "No email on record" });
  }

  if (channels.includes("sms") && ticket.phone) {
    try {
      const { sendSms } = await import("./mailer");
      const msg = `PRASA Ticket ${ticket.ticket_ref}\n${ticket.from_station} -> ${ticket.to_station} | Train ${ticket.train_no}\nDeparts: ${ticket.departure} | ${ticket.travel_class}\nFare: R${Number(ticket.fare).toFixed(2)} | ${ticket.payment_status.toUpperCase()}\nPresent this ref at boarding.`;
      await sendSms(ticket.phone, msg);
      results.push({ channel: "sms", status: "sent" });
    } catch (err: any) { results.push({ channel: "sms", status: "failed", error: err.message }); }
  } else if (channels.includes("sms")) {
    results.push({ channel: "sms", status: "skipped", error: "No phone on record" });
  }

  try {
    await supabase.from("ticket_recovery_log").insert({
      ticket_id: ticket.id,
      ticket_ref: ticket.ticket_ref,
      action: channels.map((c) => `reissue_${c}`).join("+"),
      note: results.map((r) => `${r.channel}:${r.status}`).join(" | "),
    });
  } catch { /* audit log failure is non-fatal */ }

  res.json({ ticket_ref: ticket.ticket_ref, results });
});

app.get("/api/admin/tickets/recovery-log",   requireAuth, async (_req, res) => {
  const { data, error } = await supabase.from("ticket_recovery_log").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data ?? []);
});
app.use("/api/sentiment",    sentimentRouter);
app.use("/api/lost-found",   lostFoundRouter);
app.use("/api/safety",       safetyRouter);
app.use("/api/stations",     stationSearchRouter);
app.use("/api/timetable",    timetableRouter);

app.get("/api/live-trains", async (_req, res) => {
  const { trains } = await runScrape().catch(() => ({ trains: [] }));
  res.json(trains);
});

app.get("/api/announcements", async (_req, res) => {
  const [{ notices }, updatesRes] = await Promise.all([
    runScrape().catch(() => ({ notices: [] as any[] })),
    isSupabaseConfigured()
      ? supabase.from("train_updates").select("*").order("updated_at", { ascending: false }).limit(20)
      : Promise.resolve({ data: [] }),
  ]);
  const adminUpdates = (updatesRes as any).data ?? [];
  res.json({ notices, adminUpdates });
});

app.post("/api/coach-feedback", async (req, res) => {
  const { train_no, line, from_station, to_station, coach, feedback_text,
          hf_label, hf_confidence, vader_label, vader_compound, travel_time } = req.body;
  if (!feedback_text || !coach) { res.status(400).json({ error: "Missing fields" }); return; }
  const { error } = await supabase.from("coach_feedback").insert({
    train_no, line, from_station, to_station, coach,
    feedback_text, hf_label, hf_confidence: Number(hf_confidence),
    vader_label, vader_compound: Number(vader_compound),
    travel_time, submitted_at: new Date().toISOString(),
  });
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

app.get("/api/coach-feedback", requireAuth, async (_req, res) => {
  const { data, error } = await supabase.from("coach_feedback").select("*").order("submitted_at", { ascending: false }).limit(200);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data ?? []);
});

// Line stop lists — used to expand feedback to all intermediate stations
const LINE_STOPS: Record<string, string[]> = {
  "Southern Line":   ["Cape Town","Woodstock","Salt River","Observatory","Mowbray","Rondebosch","Newlands","Claremont","Wynberg","Retreat","Muizenberg","Fish Hoek","Simon's Town"],
  "Northern Line":   ["Cape Town","Woodstock","Salt River","Pinelands","Goodwood","Parow","Bellville","Stellenbosch"],
  "Central Line":    ["Chris Hani","Khayelitsha","Nonkqubela","Nolungile","Mandalay","Stock Road","Philippi","Nyanga","Bonteheuwel","Langa","Mutual","Ysterplaat","Paarden Eiland","Esplanade","Cape Town"],
  "Cape Flats Line": ["Cape Town","Salt River","Pinelands","Nyanga","Philippi","Retreat"],
};

function stopsInRange(line: string, from: string, to: string): string[] {
  const stops = LINE_STOPS[line];
  if (!stops) return [from, to].filter(Boolean);
  const fi = stops.indexOf(from);
  const ti = stops.indexOf(to);
  if (fi === -1 || ti === -1) return [from, to].filter(Boolean);
  const [start, end] = fi <= ti ? [fi, ti] : [ti, fi];
  return stops.slice(start, end + 1);
}

// Public aggregated hotspot data for crime map (no auth — no PII exposed)
app.get("/api/hotspot-data", async (_req, res) => {
  if (!isSupabaseConfigured()) { res.json({ feedback: [], incidents: [] }); return; }
  const [feedbackRes, incidentsRes] = await Promise.all([
    supabase.from("coach_feedback")
      .select("from_station, to_station, line, vader_compound, vader_label, hf_label, hf_confidence, submitted_at")
      .order("submitted_at", { ascending: false })
      .limit(1000),
    supabase.from("safety_incidents")
      .select("station, type, status, created_at")
      .order("created_at", { ascending: false }),
  ]);

  // Expand each feedback row to all affected stations along the route
  const expanded: typeof feedbackRes.data = [];
  for (const row of feedbackRes.data ?? []) {
    const affected = stopsInRange(row.line ?? "", row.from_station, row.to_station);
    for (const station of affected) {
      expanded.push({ ...row, from_station: station, to_station: station });
    }
  }

  res.json({
    feedback: expanded,
    incidents: incidentsRes.data ?? [],
  });
});

app.post("/api/hf-proxy", async (req, res) => {
  const hfKey = process.env.HUGGINGFACE_API_KEY;
  if (!hfKey) { res.status(500).json({ error: "HF key not configured" }); return; }
  try {
    const hfRes = await fetch(
      "https://router.huggingface.co/hf-inference/models/j-hartmann/emotion-english-distilroberta-base",
      { method: "POST", headers: { Authorization: `Bearer ${hfKey}`, "Content-Type": "application/json" }, body: JSON.stringify(req.body) }
    );
    res.status(hfRes.status).json(await hfRes.json());
  } catch {
    res.status(500).json({ error: "HF request failed" });
  }
});

app.get("/api/admin/lost-found", requireAuth, async (_req, res) => {
  if (!isSupabaseConfigured()) { res.json([]); return; }
  const { data, error } = await supabase.from("lost_found").select("*").order("created_at", { ascending: false });
  if (error) { res.status(500).json({ error: "Failed to fetch lost & found items" }); return; }
  res.json(data ?? []);
});

app.patch("/api/admin/lost-found/:id", requireAuth, async (req, res) => {
  if (!isSupabaseConfigured()) { res.status(503).json({ error: "Database not configured" }); return; }
  const { status } = req.body as { status: "open" | "matched" };
  if (!["open", "matched"].includes(status)) { res.status(400).json({ error: "status must be open or matched" }); return; }

  const { data: item, error: fetchError } = await supabase.from("lost_found").select("*").eq("id", req.params.id).single();
  if (fetchError || !item) { res.status(404).json({ error: "Item not found" }); return; }

  const { data, error } = await supabase.from("lost_found").update({ status }).eq("id", req.params.id).select("*").single();
  if (error) { res.status(500).json({ error: "Failed to update item" }); return; }

  if (status === "matched" && item.status !== "matched") {
    try {
      await sendEmail({
        to: item.contact,
        subject: "Item Found - PRASA Lost & Found",
        html: "",
        templateId: process.env.EMAILJS_FOUND_TEMPLATE_ID,
        templateParams: {
          to_email: item.contact,
          contact_ref: item.contact_ref,
          item: item.item,
          station: item.station,
          date: new Date(item.date).toLocaleDateString("en-ZA"),
          found_date: new Date().toLocaleDateString("en-ZA"),
        },
      });
    } catch (emailError) {
      console.error("Failed to send found item notification:", (emailError as Error).message);
    }
  }
  res.json(data);
});

app.get("/api/admin/safety", requireAuth, async (_req, res) => {
  if (!isSupabaseConfigured()) { res.json([]); return; }
  const { data, error } = await supabase.from("safety_incidents").select("id, type, station, details, status, created_at").order("created_at", { ascending: false });
  if (error) { res.status(500).json({ error: "Failed to fetch safety incidents" }); return; }
  res.json(data ?? []);
});

app.patch("/api/admin/safety/:id", requireAuth, async (req, res) => {
  if (!isSupabaseConfigured()) { res.status(503).json({ error: "Database not configured" }); return; }
  const { status } = req.body as { status: string };
  if (!status) { res.status(400).json({ error: "status is required" }); return; }
  const { data, error } = await supabase.from("safety_incidents").update({ status }).eq("id", req.params.id).select("id, type, station, details, status, created_at").single();
  if (error) { res.status(500).json({ error: "Failed to update incident" }); return; }
  res.json(data);
});

app.post("/api/admin/schedules", requireAuth, (req, res) => {
  const item: TrainSchedule = { ...req.body, id: randomUUID() };
  schedules.push(item); res.status(201).json(item);
});
app.put("/api/admin/schedules/:id", requireAuth, (req, res) => {
  const idx = schedules.findIndex((s) => s.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: "Not found" }); return; }
  schedules[idx] = { ...schedules[idx], ...req.body, id: req.params.id };
  res.json(schedules[idx]);
});
app.delete("/api/admin/schedules/:id", requireAuth, (req, res) => {
  schedules = schedules.filter((s) => s.id !== req.params.id);
  res.json({ ok: true });
});

app.post("/api/admin/alerts", requireAuth, (req, res) => {
  const item: ServiceAlert = { ...req.body, id: randomUUID(), postedAt: new Date().toISOString() };
  alerts.unshift(item); res.status(201).json(item);
});
app.put("/api/admin/alerts/:id", requireAuth, (req, res) => {
  const idx = alerts.findIndex((a) => a.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: "Not found" }); return; }
  alerts[idx] = { ...alerts[idx], ...req.body, id: req.params.id };
  res.json(alerts[idx]);
});
app.delete("/api/admin/alerts/:id", requireAuth, (req, res) => {
  alerts = alerts.filter((a) => a.id !== req.params.id);
  res.json({ ok: true });
});

app.post("/api/admin/news", requireAuth, (req, res) => {
  const item: NewsItem = { ...req.body, id: randomUUID() };
  news.unshift(item); res.status(201).json(item);
});
app.put("/api/admin/news/:id", requireAuth, (req, res) => {
  const idx = news.findIndex((n) => n.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: "Not found" }); return; }
  news[idx] = { ...news[idx], ...req.body, id: req.params.id };
  res.json(news[idx]);
});
app.delete("/api/admin/news/:id", requireAuth, (req, res) => {
  news = news.filter((n) => n.id !== req.params.id);
  res.json({ ok: true });
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    supabase: isSupabaseConfigured() ? "connected" : "not configured",
    emailjs: !!process.env.EMAILJS_SERVICE_ID ? "configured" : "not configured",
  });
});

app.get("/api/admin/subscribers", requireAuth, async (_req, res) => {
  if (!isSupabaseConfigured()) { res.json([]); return; }
  const { data, error } = await supabase.from("users").select("id, email, station, created_at").order("created_at", { ascending: false });
  if (error) { res.status(500).json({ error: "Failed to fetch subscribers" }); return; }
  res.json(data ?? []);
});

app.get("/api/admin/stats", requireAuth, async (_req, res) => {
  let totalSubscribers = 0;
  if (isSupabaseConfigured()) {
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

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

async function scrapeAndNotify() {
  const { trains, notices } = await runScrape();
  console.log(`[cron] Scraped: ${trains.length} trains, ${notices.length} notices`);
  const { notified, failed } = await runAutoNotify(trains, notices);
  if (notified > 0 || failed > 0) {
    console.log(`[autoNotify] Sent ${notified} notification(s), ${failed} failed.`);
  }
}

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`PRASA API running on http://localhost:${PORT}`);
  // Run once on startup
  scrapeAndNotify().catch(console.error);
  // Then every 10 minutes
  cron.schedule("*/10 * * * *", () => {
    scrapeAndNotify().catch((err) => console.error("[cron] Scrape/notify failed:", err.message));
  });
});

import { Router } from "express";
import axios from "axios";
import { ChatbotSchema } from "../validate";
import { runScrape } from "../scraper";
import { supabase } from "../db";
import { STATIONS, SCHEDULES, STATION_COORDS } from "../../src/data/prasa";
import { crowdingAdvice, getCrowding, bestCoach } from "../../src/data/extras";

const router = Router();

// ── Fetch all live context from Supabase ──────────────────────────────────────
// ── Official timetable helpers (Supabase) ──────────────────────────────────────
async function queryTimetable(from: string, to: string): Promise<any[]> {
  try {
    const [{ data: fromStops }, { data: toStops }] = await Promise.all([
      supabase.from("prasa_timetable").select("route_id,train_no,stop_order,departure").ilike("station_name", from).not("departure", "is", null),
      supabase.from("prasa_timetable").select("route_id,train_no,stop_order,departure").ilike("station_name", to).not("departure", "is", null),
    ]);
    if (!fromStops?.length || !toStops?.length) return [];
    const results: any[] = [];
    for (const f of fromStops) {
      const match = toStops.find((t) => t.route_id === f.route_id && t.train_no === f.train_no && t.stop_order > f.stop_order);
      if (!match) continue;
      results.push({ train_no: f.train_no, route_id: f.route_id, from_station: from, to_station: to, departure: f.departure, arrival: match.departure });
    }
    return results.sort((a, b) => a.departure.localeCompare(b.departure));
  } catch { return []; }
}

async function queryTrainStops(trainNo: string): Promise<any[]> {
  try {
    const { data } = await supabase.from("prasa_timetable").select("station_name,stop_order,departure").eq("train_no", trainNo).not("departure", "is", null).order("stop_order", { ascending: true });
    return data ?? [];
  } catch { return []; }
}

async function fetchContext() {
  const [
    { trains: liveTrains, notices: liveNotices },
    adminUpdatesRes,
    scrapedTrainsRes,
    scrapedNoticesRes,
  ] = await Promise.all([
    runScrape(),
    supabase.from("train_updates").select("*").order("updated_at", { ascending: false }).limit(20),
    supabase.from("scraped_trains").select("*").order("scraped_at", { ascending: false }).limit(50),
    supabase.from("scraped_notices").select("*").order("scraped_at", { ascending: false }).limit(20),
  ]);

  // Prefer DB rows (persisted), fall back to in-memory scrape
  const trains: any[] = (scrapedTrainsRes.data ?? []).length > 0
    ? (scrapedTrainsRes.data ?? [])
    : liveTrains;

  const notices: any[] = (scrapedNoticesRes.data ?? []).length > 0
    ? (scrapedNoticesRes.data ?? [])
    : liveNotices;

  const adminUpdates: any[] = adminUpdatesRes.data ?? [];

  return { trains, notices, adminUpdates };
}

// ── Build OpenAI system prompt using ONLY real data ───────────────────────────
function buildPrompt(trains: any[], notices: any[], adminUpdates: any[], from?: string, to?: string): string {
  const filtered = (from || to)
    ? trains.filter((t) => {
        const row = `${t.from_station} ${t.to_station} ${t.reason ?? ""}`.toLowerCase();
        if (from && to) return row.includes(from.toLowerCase()) || row.includes(to.toLowerCase());
        if (from) return row.includes(from.toLowerCase());
        return row.includes((to ?? "").toLowerCase());
      })
    : trains;

  const routeCtx = from && to ? `${from} → ${to}` : from ?? "all routes";

  const trainLines = filtered.length > 0
    ? filtered.map((t) =>
        `[${t.line}] ${t.train_no} | ${t.from_station} → ${t.to_station} | ${t.departure}${t.arrival ? ` → ${t.arrival}` : ""} | Status: ${t.status}${t.delay_min ? ` (+${t.delay_min}min)` : ""}${t.reason ? ` | ${t.reason}` : ""}`
      ).join("\n")
    : "No live train data available for this route right now.";

  const noticeLines = notices.length > 0
    ? notices.map((n) => `[${n.line}] ${n.body ?? n.title}`).join("\n")
    : "No notices.";

  const updateLines = adminUpdates.length > 0
    ? adminUpdates.map((u) =>
        `Train #${u.train_no} at ${u.station} (${u.line}) — ${u.status}${u.delay_min ? ` +${u.delay_min}min` : ""}${u.reason ? ` | ${u.reason}` : ""}`
      ).join("\n")
    : "No admin updates.";

  return `You are a helpful PRASA Metrorail assistant for Cape Town, South Africa.
Answer ONLY using the live data provided below for route: ${routeCtx}. Do not show data for other routes.
Do not invent train numbers, times or statuses.
If asked about a safe or least crowded coach, recommend rear coaches (6-8) as they are least crowded, and present all 8 coaches in a markdown table.
If the data does not contain enough information, say so honestly and suggest the user check cttrains.co.za.
ALWAYS format train/notice data as a markdown table. Be concise and friendly.
Available stations: ${STATIONS.join(", ")}.

=== LIVE TRAINS FOR ${routeCtx.toUpperCase()} ===
${trainLines}

=== LIVE NOTICES ===
${noticeLines}

=== ADMIN UPDATES ===
${updateLines}`;
}

// ── Route handler ─────────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const parsed = ChatbotSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid message" });
    return;
  }

  const { message } = parsed.data;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const lower = message.toLowerCase();
  const { from, to } = detectStations(message);

  const { trains, notices, adminUpdates } = await fetchContext();

  // Check for specific train number query (e.g. "train 3405", "train no 3407")
  const trainNoMatch = message.match(/\b(3[34]\d{2})\b/);

  // ── Official timetable queries — always checked first ────────────────────
  if (trainNoMatch) {
    const stops = await queryTrainStops(trainNoMatch[1]);
    if (stops.length > 0) {
      let reply = `**Train ${trainNoMatch[1]} — Stellenbosch Line stops:**\n\n`;
      reply += `| # | Station | Departure |\n|---|---------|-----------|\n`;
      reply += stops.map((s, i) => `| ${i + 1} | ${s.station_name} | ${s.departure} |`).join("\n");
      res.json({ reply }); return;
    }
  }

  if (from && to) {
    const ttResults = await queryTimetable(from, to);
    if (ttResults.length > 0) {
      const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
      const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
      const upcoming = ttResults.filter((r) => toMin(r.departure) >= nowMins);
      const display = (upcoming.length > 0 ? upcoming : ttResults).slice(0, 6);
      let reply = `**Official timetable — ${from} \u2192 ${to} (Stellenbosch Line):**\n\n`;
      reply += `| Train | Departs | Arrives | Duration |\n|-------|---------|---------|----------|\n`;
      reply += display.map((r) => {
        const dep = toMin(r.departure);
        const arr = toMin(r.arrival);
        const dur = arr >= dep ? arr - dep : arr + 1440 - dep;
        return `| ${r.train_no} | ${r.departure} | ${r.arrival} | ${dur} min |`;
      }).join("\n");
      if (upcoming.length === 0) reply += `\n\n_No more trains today — showing full timetable._`;
      res.json({ reply }); return;
    }
  }

  // Also check reverse direction in case user said "Cape Town to Du Toit" but timetable has it stored as down route
  if (from && to) {
    const ttReverse = await queryTimetable(to, from);
    if (ttReverse.length > 0) {
      // Re-run with corrected direction
      const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
      const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
      const upcoming = ttReverse.filter((r) => toMin(r.departure) >= nowMins);
      const display = (upcoming.length > 0 ? upcoming : ttReverse).slice(0, 6);
      let reply = `**Official timetable — ${to} \u2192 ${from} (Stellenbosch Line):**\n\n`;
      reply += `| Train | Departs | Arrives | Duration |\n|-------|---------|---------|----------|\n`;
      reply += display.map((r) => {
        const dep = toMin(r.departure);
        const arr = toMin(r.arrival);
        const dur = arr >= dep ? arr - dep : arr + 1440 - dep;
        return `| ${r.train_no} | ${r.departure} | ${r.arrival} | ${dur} min |`;
      }).join("\n");
      if (upcoming.length === 0) reply += `\n\n_No more trains today — showing full timetable._`;
      res.json({ reply }); return;
    }
  }

  // Always try rule-based first — covers fares, greetings, coach, arrival, crowding, contact
  const needsLiveAI = apiKey && /(delay|cancel|status|disruption|suspend|on time|running|what.*happening|any.*problem|latest|update|live|current|today|now)/.test(lower)
    && !/(fare|price|cost|how much|rand|zar|pay|charge|hi|hello|hey|howzit|safe|coach|crowd|contact|call centre|next stop|next station|platform|exit|arriving)/.test(lower);

  if (!needsLiveAI) {
    res.json({ reply: ruleBasedReply(message, trains, notices, adminUpdates) });
    return;
  }

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: buildPrompt(trains, notices, adminUpdates, from, to) },
          { role: "user", content: message },
        ],
        max_tokens: 600,
        temperature: 0.2,
      },
      { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 15_000 }
    );
    res.json({ reply: response.data.choices[0]?.message?.content ?? "Sorry, no response." });
  } catch (err: any) {
    const status = err?.response?.status;
    console.error(`OpenAI error (${status ?? "unknown"}):`, err.message);
    // Always fall back gracefully — never surface an error to the user
    res.json({ reply: ruleBasedReply(message, trains, notices, adminUpdates) });
  }
});

// ── Station detection ─────────────────────────────────────────────────────────
function detectStations(text: string): { from?: string; to?: string } {
  const lower = text.toLowerCase();
  const sorted = [...STATIONS].sort((a, b) => b.length - a.length);
  const mentioned = sorted
    .filter((s) => lower.includes(s.toLowerCase()))
    .map((s) => ({ s, i: lower.indexOf(s.toLowerCase()) }))
    .sort((a, b) => a.i - b.i);

  // Respect explicit "from X to Y" ordering
  const fromIdx = lower.indexOf(" from ");
  const toIdx   = lower.indexOf(" to ");
  if (mentioned.length >= 2 && fromIdx !== -1 && toIdx !== -1 && fromIdx < toIdx) {
    const afterFrom = mentioned.filter((m) => m.i > fromIdx);
    const afterTo   = mentioned.filter((m) => m.i > toIdx);
    if (afterFrom.length > 0 && afterTo.length > 0)
      return { from: afterFrom[0].s, to: afterTo[0].s };
  }
  if (mentioned.length >= 2) return { from: mentioned[0].s, to: mentioned[1].s };
  if (mentioned.length === 1) return { from: mentioned[0].s };
  return {};
}

// ── Arrival assistant ────────────────────────────────────────────────────────
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// Average train speed on Cape Town Metrorail (km/h) — used for ETA estimates
const AVG_SPEED_KMH = 45;

function arrivalAssistantReply(message: string, trains: any[], from?: string, to?: string): string {
  if (!from) {
    return `Please tell me your current station — e.g. "Next stop from Cape Town to Claremont".`;
  }

  // Find the best schedule: matches from→to and departs closest to now
  const nowMins = (() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); })();

  const candidates = SCHEDULES.filter((s) => {
    const stops = s.stops.map((x) => x.toLowerCase());
    const fi = stops.indexOf(from.toLowerCase());
    const ti = to ? stops.indexOf(to.toLowerCase()) : fi + 1;
    return fi !== -1 && ti !== -1 && fi < ti;
  }).sort((a, b) => {
    // Prefer trains that depart at or after now; wrap around midnight
    const [ah, am] = a.departure.split(":").map(Number);
    const [bh, bm] = b.departure.split(":").map(Number);
    const aMin = ah * 60 + am;
    const bMin = bh * 60 + bm;
    const aDiff = aMin >= nowMins ? aMin - nowMins : aMin + 1440 - nowMins;
    const bDiff = bMin >= nowMins ? bMin - nowMins : bMin + 1440 - nowMins;
    return aDiff - bDiff;
  });

  const src = candidates[0];

  if (!src) {
    // Fall back to live scraped data
    const t = trains.find((x: any) => {
      const row = `${x.from_station} ${x.to_station}`.toLowerCase();
      return row.includes(from.toLowerCase()) || (to && row.includes(to.toLowerCase()));
    });
    if (t) {
      return `**Live train:** ${t.train_no} (${t.line}) — ${t.from_station} → ${t.to_station}\nDeparture: ${t.departure || "—"} | Status: ${t.status}${t.delay_min ? ` (+${t.delay_min}min)` : ""}\n\nFor detailed stop-by-stop info specify both stations.`;
    }
    return `No train found between **${from}**${to ? ` and **${to}**` : ""}. Check cttrains.co.za for live schedules.`;
  }

  const stops = src.stops;
  const fromIdx = stops.map((x) => x.toLowerCase()).indexOf(from.toLowerCase());
  const toIdx   = to ? stops.map((x) => x.toLowerCase()).indexOf(to.toLowerCase()) : stops.length - 1;
  const nextIdx = Math.min(fromIdx + 1, stops.length - 1);
  const nextStop = stops[nextIdx];
  const finalStop = stops[toIdx !== -1 ? toIdx : stops.length - 1];

  // Per-stop duration using haversine + avg speed
  function etaBetween(iA: number, iB: number): number {
    let totalKm = 0;
    for (let i = iA; i < iB; i++) {
      const a = STATION_COORDS[stops[i]];
      const b = STATION_COORDS[stops[i + 1]];
      if (a && b) totalKm += haversineKm(a, b);
    }
    return Math.round((totalKm / AVG_SPEED_KMH) * 60);
  }

  const minsToNext = etaBetween(fromIdx, nextIdx);
  const minsToDest = etaBetween(fromIdx, toIdx !== -1 ? toIdx : stops.length - 1);

  // Departure time from the "from" station
  const [dh, dm] = src.departure.split(":").map(Number);
  const depFromMins = dh * 60 + dm + etaBetween(0, fromIdx);
  const nextArrMins = depFromMins + minsToNext;
  const destArrMins = depFromMins + minsToDest;
  const fmt = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  const platformInfo = src.platform !== "—" ? `Platform **${src.platform}**` : "Check platform board";

  const delayNote = src.status === "Delayed" && src.delayMin
    ? `\n\n⚠ This train is currently delayed by **${src.delayMin} minutes**.`
    : "";

  let reply = `**Next Train — #${src.trainNo} (${src.line})**\n\n`;
  reply += `| Detail | Info |\n|--------|------|\n`;
  reply += `| Departing | **${src.departure}** from ${stops[0]} |\n`;
  reply += `| Your board station | **${from}** (~${fmt(depFromMins)}) |\n`;
  reply += `| Next stop | **${nextStop}** (~${fmt(nextArrMins)}, ${minsToNext} min) |\n`;
  reply += `| Your destination | **${finalStop}** (~${fmt(destArrMins)}) |\n`;
  reply += `| Travel time to destination | ~${minsToDest} min |\n`;
  reply += `| Platform at origin | ${platformInfo} |\n`;

  // Show all remaining stops with estimated times
  reply += `\n**Remaining stops from ${from}:**\n| Stop | Est. Arrival |\n|------|-------------|\n`;
  for (let i = fromIdx + 1; i <= (toIdx !== -1 ? toIdx : stops.length - 1); i++) {
    const eta = depFromMins + etaBetween(fromIdx, i);
    reply += `| ${stops[i]} | ~${fmt(eta)} |\n`;
  }

  reply += delayNote;
  return reply;
}

// ── Safe coach recommendation ─────────────────────────────────────────────────
function safeCoachReply(from: string, to?: string): string {
  // Determine the line from the schedule
  const schedule = SCHEDULES.find((s) => {
    const stops = s.stops.map((x) => x.toLowerCase());
    const fi = stops.indexOf(from.toLowerCase());
    const ti = to ? stops.indexOf(to.toLowerCase()) : fi + 1;
    return fi !== -1 && ti !== -1 && fi < ti;
  });

  const line = schedule?.line ?? "Central Line";
  const loads = getCrowding("", 8, line);
  const best  = bestCoach(loads);

  const routeLabel = to ? `${from} → ${to}` : `from ${from}`;

  let reply = `**Safe coach recommendation for ${routeLabel} (${line}):**\n`;
  reply += `| Coach | Occupancy | Level | Recommendation |\n`;
  reply += `|-------|-----------|-------|----------------|\n`;
  reply += loads.map((c) => {
    const rec = c.coach === best.coach
      ? "✅ **Best choice**"
      : c.level === "Low"
        ? "👍 Good"
        : c.level === "Moderate"
          ? "⚠ Moderate"
          : "❌ Avoid";
    return `| Coach ${c.coach} | ${c.load}% | ${c.level} | ${rec} |`;
  }).join("\n");

  reply += `\n\n✅ **Board Coach ${best.coach}** — it's the least crowded (${best.load}% full, ${best.level} occupancy).`;
  reply += `\n💡 Tip: Rear coaches (6–8) are generally safer and less crowded. Avoid coaches 1–2 near the front.`;
  return reply;
}

// ── Rule-based fallback — uses ONLY real scraped data ─────────────────────────
function ruleBasedReply(message: string, trains: any[], notices: any[], adminUpdates: any[]): string {
  const lower = message.toLowerCase();

  // Fare / price / cost / ticket price queries — MUST be first to avoid being caught by route/live handlers
  if (/(fare|price|cost|how much|ticket price|what.*cost|what.*fare|what.*price|rand|zar|pay|charge)/.test(lower)) {
    const fareTable = [
      { line: "Southern Line", fare: "R14.50" },
      { line: "Northern Line", fare: "R13.00" },
      { line: "Central Line",  fare: "R12.50" },
      { line: "Cape Flats Line", fare: "R12.00" },
    ];
    const matched = fareTable.find((f) => lower.includes(f.line.toLowerCase()));
    if (matched) {
      return `**Fare for the ${matched.line}:** ${matched.fare} per trip\n\n💡 Metroplus tickets offer discounts — ask at any station ticket office.`;
    }
    let reply = `**PRASA Metrorail Fares (single trip):**\n\n`;
    reply += `| Line | Fare |\n|------|------|\n`;
    reply += fareTable.map((f) => `| ${f.line} | ${f.fare} |`).join("\n");
    reply += `\n\n💡 Fares are for standard class. Metroplus discounts available at ticket offices.\n🎫 Generate a ticket in the **My Tickets** section of this app.`;
    return reply;
  }

  // Greeting
  if (/\b(hi|hello|hey|sawubona|molo|howzit|good morning|good afternoon)\b/.test(lower)) {
    const hasLive = trains.length > 0 || notices.length > 0;
    let reply = `Hello! I'm your PRASA Metrorail assistant.\n\n`;
    reply += `Ask me about:\n`;
    reply += `• Delays & cancellations — "Are there delays today?"\n`;
    reply += `• Live train status — "Status on Northern Line"\n`;
    reply += `• Route info — "Train from Stellenbosch to Cape Town"\n`;
    reply += `• Safe coach — "Safe coach from Khayelitsha"\n`;
    reply += `• Crowding — "How busy is the Southern Line?"\n`;
    reply += `• Arrival — "Next stop from Cape Town to Claremont"\n\n`;
    if (hasLive) reply += `I currently have **${trains.length}** live train update(s) and **${notices.length}** notice(s).`;
    else reply += `No live data at the moment — try again shortly.`;
    return reply;
  }

  // Any question — lead with ALL live data first
  const lineMatch = ["Southern Line", "Northern Line", "Central Line", "Cape Flats Line"].find(
    (l) => lower.includes(l.toLowerCase())
  );
  const { from, to } = detectStations(message);

  // Filter trains relevant to the query — strict match when both from+to are known
  const relevantTrains = trains.filter((t: any) => {
    const f = t.from_station?.toLowerCase() ?? "";
    const d = t.to_station?.toLowerCase()   ?? "";
    const l = t.line?.toLowerCase()          ?? "";
    const body = (t.reason ?? "").toLowerCase();

    if (from && to) {
      // Both stations specified — match trains that mention either station in from/to/body
      return f.includes(from.toLowerCase()) || d.includes(from.toLowerCase()) ||
             f.includes(to.toLowerCase())   || d.includes(to.toLowerCase())   ||
             body.includes(from.toLowerCase()) || body.includes(to.toLowerCase());
    }
    if (from) return f.includes(from.toLowerCase()) || d.includes(from.toLowerCase()) || body.includes(from.toLowerCase());
    if (to)   return f.includes(to.toLowerCase())   || d.includes(to.toLowerCase())   || body.includes(to.toLowerCase());
    if (lineMatch) return l.includes(lineMatch.toLowerCase());
    return true;
  });

  const relevantNotices = notices.filter((n: any) => {
    const row = `${n.line} ${n.body ?? n.title}`.toLowerCase();
    if (from && to)  return row.includes(from.toLowerCase()) || row.includes(to.toLowerCase());
    if (from)        return row.includes(from.toLowerCase());
    if (lineMatch)   return row.includes(lineMatch.toLowerCase());
    return true;
  });

  const relevantUpdates = adminUpdates.filter((u: any) => {
    const row = `${u.line ?? ""} ${u.station ?? ""} ${u.reason ?? ""}`.toLowerCase();
    if (from && to)  return row.includes(from.toLowerCase()) || row.includes(to.toLowerCase());
    if (from)        return row.includes(from.toLowerCase());
    if (lineMatch)   return row.includes(lineMatch.toLowerCase());
    return true;
  });

  // Arrival assistant
  if (/(next stop|next station|arrival|arriving|platform|exit|which platform|what platform|where.*stop|when.*arrive)/.test(lower)) {
    return arrivalAssistantReply(message, trains, from, to);
  }

  // Status / delay / cancellation queries
  if (/(delay|cancel|status|disruption|suspend|on time|running|what.*happening|any.*problem|service)/.test(lower)) {
    return buildLiveReply(relevantTrains, relevantNotices, relevantUpdates, lineMatch, from, to);
  }

  // "What's happening" / general live query
  if (/(what|latest|update|news|live|current|today|now)/.test(lower)) {
    return buildLiveReply(relevantTrains, relevantNotices, relevantUpdates, lineMatch, from, to);
  }

  // Route / schedule query
  if (/(train|when|next|depart|arriv|route|from|to|go|travel|get to|schedule)/.test(lower)) {
    if (trains.length === 0 && notices.length === 0) {
      return "No live train data available right now. Please check cttrains.co.za for the latest schedules.";
    }
    return buildLiveReply(relevantTrains, relevantNotices, relevantUpdates, lineMatch, from, to);
  }

  // Safe coach / crowding
  if (/(safe|coach|crowd|busy|full|space|carriage|least busy|most space|safest|which coach|what coach)/.test(lower)) {
    // If asking about safety of a specific coach/carriage, give coach recommendation
    if (/(safe|safest|which coach|what coach|recommend)/.test(lower) && from) {
      return safeCoachReply(from, to);
    }
    const timeMatch = lower.match(/(\d{1,2}:\d{2})/);
    const resolvedLine = lineMatch
      ?? (from ? trains.find((t: any) => `${t.from_station} ${t.to_station}`.toLowerCase().includes(from.toLowerCase()))?.line : undefined)
      ?? "Southern Line";
    return crowdingAdvice(resolvedLine, timeMatch?.[1]);
  }

  // Contact / help
  if (/(contact|call centre|call center|phone|help|support|complaint)/.test(lower)) {
    return `**PRASA Contact Information:**\n\n| Channel | Details |\n|---------|---------|\n| Call Centre | 0800 65 64 63 (toll-free) |\n| Website | www.prasa.com |\n| Safety SOS | Use the SOS feature in this app |`;
  }

  // Default — show all live data
  return buildLiveReply(trains, notices, adminUpdates, undefined, undefined, undefined);
}

function buildLiveReply(
  trains: any[],
  notices: any[],
  adminUpdates: any[],
  line?: string,
  from?: string,
  to?: string
): string {
  const context = line ? ` on the ${line}` : (from && to) ? ` for ${from} → ${to}` : from ? ` for ${from}` : "";
  let reply = "";

  if (adminUpdates.length > 0) {
    reply += `**Admin updates${context}:**\n`;
    reply += `| Train | Station | Line | Status | Delay | Reason |\n`;
    reply += `|-------|---------|------|--------|-------|--------|\n`;
    reply += adminUpdates
      .slice(0, 5)
      .map((u: any) =>
        `| ${u.train_no} | ${u.station} | ${u.line} | ${u.status} | ${u.delay_min ? `+${u.delay_min}min` : "—"} | ${u.reason ?? "—"} |`
      )
      .join("\n");
    reply += "\n\n";
  }

  if (notices.length > 0) {
    reply += `**Live notices${context}:**\n`;
    reply += `| Line | Notice |\n`;
    reply += `|------|--------|\n`;
    reply += notices
      .slice(0, 5)
      .map((n: any) => `| ${n.line} | ${(n.body ?? n.title).replace(/\|/g, "-")} |`)
      .join("\n");
    reply += "\n\n";
  }

  if (trains.length > 0) {
    reply += `**Live train updates${context}:**\n`;
    reply += `| Train | From | To | Departure | Line | Status | Delay | Reason |\n`;
    reply += `|-------|------|----|-----------|------|--------|-------|--------|\n`;
    reply += trains
      .slice(0, 8)
      .map((t: any) => {
        const fromCol = (t.from_station === "Unknown" || !t.from_station)
          ? (from ?? line?.replace(" Line", "") ?? "—")
          : t.from_station;
        return `| ${t.train_no} | ${fromCol} | ${t.to_station} | ${t.departure || "—"} | ${t.line} | ${t.status} | ${t.delay_min ? `+${t.delay_min}min` : "—"} | ${(t.reason || "—").replace(/\|/g, "-")} |`;
      })
      .join("\n");
  }

  if (!reply) {
    return `No live data available${context} right now. Check cttrains.co.za for the latest updates.`;
  }

  return reply.trim();
}

export default router;

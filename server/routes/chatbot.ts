import { Router } from "express";
import axios from "axios";
import { ChatbotSchema } from "../validate";
import { runScrape } from "../scraper";
import { supabase } from "../db";
import { STATIONS, SCHEDULES } from "../../src/data/prasa";
import { crowdingAdvice, getCrowding, bestCoach } from "../../src/data/extras";

const router = Router();

// ── Fetch all live context from Supabase ──────────────────────────────────────
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

  // Intercept safe coach queries — handle directly without OpenAI
  if (/(safe|safest|which coach|what coach|recommend.*coach|coach.*safe)/.test(lower) && from) {
    res.json({ reply: safeCoachReply(from, to) });
    return;
  }

  if (!apiKey) {
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
  } catch (err) {
    console.error("OpenAI error:", (err as Error).message);
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

  // Greeting
  if (/\b(hi|hello|hey|sawubona|molo|howzit|good morning|good afternoon)\b/.test(lower)) {
    const hasLive = trains.length > 0 || notices.length > 0;
    let reply = `Hello! I'm your PRASA Metrorail assistant.\n\n`;
    reply += `Ask me about:\n`;
    reply += `• Delays & cancellations — "Are there delays today?"\n`;
    reply += `• Live train status — "Status on Northern Line"\n`;
    reply += `• Route info — "Train from Stellenbosch to Cape Town"\n`;
    reply += `• Safe coach — "Safe coach from Khayelitsha"\n`;
    reply += `• Crowding — "How busy is the Southern Line?"\n\n`;
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

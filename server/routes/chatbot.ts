import { Router } from "express";
import axios from "axios";
import { ChatbotSchema } from "../validate";
import { runScrape } from "../scraper";
import { supabase } from "../db";
import { STATIONS } from "../../src/data/prasa";
import { crowdingAdvice } from "../../src/data/extras";

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
function buildPrompt(trains: any[], notices: any[], adminUpdates: any[]): string {
  const trainLines = trains.length > 0
    ? trains.map((t) =>
        `[${t.line}] ${t.train_no} | ${t.from_station} → ${t.to_station} | ${t.departure}${t.arrival ? ` → ${t.arrival}` : ""} | Status: ${t.status}${t.delay_min ? ` (+${t.delay_min}min)` : ""}${t.reason ? ` | ${t.reason}` : ""}`
      ).join("\n")
    : "No live train data available right now.";

  const noticeLines = notices.length > 0
    ? notices.map((n) => `[${n.line}] ${n.body ?? n.title}`).join("\n")
    : "No notices.";

  const updateLines = adminUpdates.length > 0
    ? adminUpdates.map((u) =>
        `Train #${u.train_no} at ${u.station} (${u.line}) — ${u.status}${u.delay_min ? ` +${u.delay_min}min` : ""}${u.reason ? ` | ${u.reason}` : ""}`
      ).join("\n")
    : "No admin updates.";

  return `You are a helpful PRASA Metrorail assistant for Cape Town, South Africa.
Answer ONLY using the live data provided below. Do not invent train numbers, times or statuses.
If the data does not contain enough information to answer, say so honestly and suggest the user check cttrains.co.za.
Be concise and friendly. Available stations: ${STATIONS.join(", ")}.

=== LIVE TRAINS (scraped from cttrains.co.za) ===
${trainLines}

=== LIVE NOTICES (scraped from cttrains.co.za) ===
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

  const { trains, notices, adminUpdates } = await fetchContext();

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
          { role: "system", content: buildPrompt(trains, notices, adminUpdates) },
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

  if (mentioned.length >= 2) return { from: mentioned[0].s, to: mentioned[1].s };
  if (mentioned.length === 1) return { from: mentioned[0].s };
  return {};
}

// ── Rule-based fallback — uses ONLY real scraped data ─────────────────────────
function ruleBasedReply(message: string, trains: any[], notices: any[], adminUpdates: any[]): string {
  const lower = message.toLowerCase();

  // Greeting
  if (/\b(hi|hello|hey|sawubona|molo|howzit|good morning|good afternoon)\b/.test(lower)) {
    const hasLive = trains.length > 0 || notices.length > 0;
    return (
      `Hello! I'm your PRASA Metrorail assistant.\n` +
      (hasLive
        ? `I have **${trains.length} live train update(s)** and **${notices.length} notice(s)** right now.\n\n`
        : `No live data at the moment — try again shortly.\n\n`) +
      `Ask me about:\n• Current delays or cancellations\n• Live train status by line\n• Service notices\n• Coach crowding advice`
    );
  }

  // Any question — lead with ALL live data first
  const lineMatch = ["Southern Line", "Northern Line", "Central Line", "Cape Flats Line"].find(
    (l) => lower.includes(l.toLowerCase())
  );
  const { from, to } = detectStations(message);

  // Filter trains relevant to the query
  const relevantTrains = trains.filter((t: any) => {
    if (!lineMatch && !from && !to) return true;
    const row = `${t.from_station} ${t.to_station} ${t.line}`.toLowerCase();
    if (lineMatch && row.includes(lineMatch.toLowerCase())) return true;
    if (from && row.includes(from.toLowerCase())) return true;
    if (to && row.includes(to.toLowerCase())) return true;
    return false;
  });

  const relevantNotices = notices.filter((n: any) => {
    if (!lineMatch && !from) return true;
    const row = `${n.line} ${n.body ?? n.title}`.toLowerCase();
    if (lineMatch && row.includes(lineMatch.toLowerCase())) return true;
    if (from && row.includes(from.toLowerCase())) return true;
    return false;
  });

  const relevantUpdates = adminUpdates.filter((u: any) => {
    if (!lineMatch && !from) return true;
    if (lineMatch && u.line?.toLowerCase().includes(lineMatch.toLowerCase())) return true;
    if (from && u.station?.toLowerCase().includes(from.toLowerCase())) return true;
    return false;
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

  // Coach / crowding
  if (/(coach|crowd|busy|full|space|carriage|least busy|most space)/.test(lower)) {
    const timeMatch = lower.match(/(\d{1,2}:\d{2})/);
    const resolvedLine = lineMatch
      ?? (from ? trains.find((t: any) => `${t.from_station} ${t.to_station}`.toLowerCase().includes(from.toLowerCase()))?.line : undefined)
      ?? "Southern Line";
    return crowdingAdvice(resolvedLine, timeMatch?.[1]);
  }

  // Contact / help
  if (/(contact|call centre|call center|phone|help|support|complaint)/.test(lower)) {
    return `**PRASA contact:**\n• Call Centre: **0800 65 64 63** (toll-free)\n• Website: www.prasa.com\n• Safety emergencies: use the SOS feature in this app`;
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
  const context = line ? ` on the ${line}` : from ? ` for ${from}` : "";
  let reply = "";

  if (adminUpdates.length > 0) {
    reply += `**Admin updates${context}:**\n`;
    reply += adminUpdates
      .slice(0, 5)
      .map((u: any) =>
        `• Train #${u.train_no} at **${u.station}** (${u.line}) — **${u.status}**${u.delay_min ? ` +${u.delay_min}min` : ""}${u.reason ? `\n  _${u.reason}_` : ""}`
      )
      .join("\n");
    reply += "\n\n";
  }

  if (notices.length > 0) {
    reply += `**Live notices${context}:**\n`;
    reply += notices
      .slice(0, 5)
      .map((n: any) => `• [**${n.line}**] ${n.body ?? n.title}`)
      .join("\n");
    reply += "\n\n";
  }

  if (trains.length > 0) {
    reply += `**Live train updates${context}:**\n`;
    reply += trains
      .slice(0, 8)
      .map((t: any) =>
        `• **${t.train_no}** | ${t.from_station} → ${t.to_station} | ${t.departure || "—"} | [${t.line}] | **${t.status}**${t.delay_min ? ` +${t.delay_min}min` : ""}${t.reason ? `\n  _${t.reason}_` : ""}`
      )
      .join("\n");
  }

  if (!reply) {
    return `No live data available${context} right now. Check cttrains.co.za for the latest updates.`;
  }

  return reply.trim();
}

export default router;

import { Router } from "express";
import axios from "axios";
import { ChatbotSchema } from "../validate";
import { scrapeTrains } from "../scraper";
import { supabase } from "../db";
import { SCHEDULES, ALERTS, STATIONS, searchTrains } from "../../src/data/prasa";

const router = Router();

router.post("/", async (req, res) => {
  const parsed = ChatbotSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid message" });
    return;
  }

  const { message } = parsed.data;
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  // Build context from all data sources in parallel
  const [scraped, recentUpdates] = await Promise.all([
    scrapeTrains(),
    Promise.resolve(
      supabase
        .from("train_updates")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(10)
    ).then(({ data }) => (data ?? []) as any[]).catch((): any[] => []),
  ]);

  const scheduleSummary = SCHEDULES.map(
    (s) =>
      `Train #${s.trainNo} (${s.line}): ${s.from} → ${s.to}, departs ${s.departure}, arrives ${s.arrival}, status: ${s.status}${s.delayMin ? ` (+${s.delayMin}min)` : ""}, fare: R${s.fare}, stops: ${s.stops.join(" → ")}`,
  ).join("\n");

  const alertSummary = ALERTS.map(
    (a) => `[${a.level.toUpperCase()}] ${a.title}: ${a.message}`,
  ).join("\n");

  const scrapedSummary =
    scraped.length > 0
      ? scraped.map((s: any) => `LIVE: ${s.from} → ${s.to} at ${s.departure} — ${s.status}`).join("\n")
      : "No live scraped data available from cttrain.co.za.";

  const updateSummary =
    (recentUpdates as any[]).length > 0
      ? (recentUpdates as any[])
          .map(
            (u) =>
              `Admin update: Train #${u.train_no} at ${u.station} (${u.line}) — ${u.status}${u.delay_min ? ` (+${u.delay_min}min)` : ""}${u.reason ? `, reason: ${u.reason}` : ""} (${new Date(u.updated_at).toLocaleString("en-ZA")})`,
          )
          .join("\n")
      : "No recent admin updates.";

  const systemPrompt = `You are a helpful PRASA Metrorail assistant for the Western Cape, South Africa.
Answer questions about train availability, delays, cancellations, fares, and route recommendations.
Be concise, friendly and accurate. Always give specific train numbers, departure times and platforms.
When a user asks about a route, search the schedules below and list the available trains.
If a train is delayed or cancelled, explain the reason if known and suggest the next available service.
Never ask the user to repeat information they already gave — use the full conversation context.

Available stations: ${STATIONS.join(", ")}

Current train schedules:
${scheduleSummary}

Active service alerts:
${alertSummary}

Live scraped data from cttrain.co.za:
${scrapedSummary}

Recent admin updates:
${updateSummary}`;

  if (!apiKey) {
    const reply = smartRuleBasedReply(message, recentUpdates as any[]);
    res.json({ reply });
    return;
  }

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        max_tokens: 500,
        temperature: 0.3,
      },
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 15_000,
      },
    );

    const reply =
      response.data.choices[0]?.message?.content ??
      "Sorry, I couldn't generate a response.";
    res.json({ reply });
  } catch (err) {
    console.error("OpenAI error:", (err as Error).message);
    const reply = smartRuleBasedReply(message, recentUpdates as any[]);
    res.json({ reply });
  }
});

// ── Smart rule-based fallback ─────────────────────────────────────────────────
function detectStations(text: string): { from?: string; to?: string } {
  const lower = text.toLowerCase();

  // "from X to Y" pattern
  const m = lower.match(/from\s+(.+?)\s+to\s+(.+?)(?:\s|$)/i);
  if (m) {
    const from = STATIONS.find((s) => m[1].toLowerCase().includes(s.toLowerCase()));
    const to = STATIONS.find((s) => m[2].toLowerCase().includes(s.toLowerCase()));
    if (from && to) return { from, to };
  }

  // "X to Y" pattern
  const m2 = lower.match(/([a-z' ]+?)\s+to\s+([a-z' ]+?)(?:\s|$)/i);
  if (m2) {
    const from = STATIONS.find((s) => m2[1].toLowerCase().includes(s.toLowerCase()));
    const to = STATIONS.find((s) => m2[2].toLowerCase().includes(s.toLowerCase()));
    if (from && to) return { from, to };
  }

  // Find any mentioned stations
  const found = STATIONS.filter((s) => lower.includes(s.toLowerCase()));
  if (found.length >= 2) return { from: found[0], to: found[1] };
  if (found.length === 1) return { from: found[0] };
  return {};
}

function smartRuleBasedReply(message: string, updates: any[]): string {
  const lower = message.toLowerCase();

  // Greeting
  if (/\b(hi|hello|hey|sawubona|molo|good morning|good afternoon)\b/.test(lower)) {
    return "Hello! I'm your PRASA Metrorail assistant. I can help with:\n• Train schedules between any two stations\n• Live delays and cancellations\n• Fares and ticket prices\n• Service alerts\n\nTry: \"Next train from Cape Town to Bellville\"";
  }

  // Admin updates check first
  if (updates.length > 0) {
    const relevant = updates.find(
      (u) =>
        lower.includes(u.station?.toLowerCase()) ||
        lower.includes(u.train_no?.toLowerCase()),
    );
    if (relevant) {
      return `Latest update for **${relevant.station}**: Train #${relevant.train_no} (${relevant.line}) is **${relevant.status}**${relevant.delay_min ? ` (+${relevant.delay_min}min)` : ""}${relevant.reason ? `\nReason: ${relevant.reason}` : ""}`;
    }
  }

  // Delays / alerts
  if (/(delay|alert|cancel|disruption|status|problem|issue)/.test(lower)) {
    const lineMatch = ["Southern Line", "Northern Line", "Central Line", "Cape Flats Line"].find(
      (l) => lower.includes(l.toLowerCase()),
    );
    const disrupted = SCHEDULES.filter((s) =>
      s.status !== "On Time" && (!lineMatch || s.line === lineMatch),
    );
    const alertList = lineMatch
      ? ALERTS.filter((a) => a.line === lineMatch)
      : ALERTS;

    let reply = "";
    if (disrupted.length > 0) {
      reply += `**Disrupted services${lineMatch ? ` on ${lineMatch}` : ""}:**\n`;
      reply += disrupted
        .map((s) => `• Train #${s.trainNo} (${s.from} → ${s.to}): **${s.status}**${s.delayMin ? ` +${s.delayMin}min` : ""}`)
        .join("\n");
    }
    if (alertList.length > 0) {
      reply += reply ? "\n\n" : "";
      reply += `**Active alerts:**\n`;
      reply += alertList.map((a) => `• ${a.title} — ${a.message}`).join("\n");
    }
    return reply || `No disruptions reported${lineMatch ? ` on the ${lineMatch}` : ""} right now.`;
  }

  // Fare
  if (/(fare|cost|price|ticket|how much|rand|r\d)/.test(lower)) {
    const { from, to } = detectStations(message);
    if (from && to) {
      const trains = searchTrains(from, to);
      if (trains.length > 0) {
        const t = trains[0];
        return `A Metro ticket from **${from}** to **${to}** costs **R${t.fare.toFixed(2)}** (one way) on the ${t.line}.`;
      }
    }
    return "Metro fares range from R11 to R14.50 depending on the route. Tell me your origin and destination for an exact fare.";
  }

  // Schedule / route lookup — this is the main fix
  if (/(train|schedule|when|next|depart|arriv|route|trip|from|to|go|travel|get to)/.test(lower)) {
    const { from, to } = detectStations(message);

    if (from && to) {
      const trains = searchTrains(from, to);
      if (trains.length === 0) {
        return `No direct trains found from **${from}** to **${to}**. You may need to connect via Cape Town or Salt River. Try the Trip Planner for multi-leg routes.`;
      }
      const top = trains.slice(0, 4);
      return (
        `**Trains from ${from} to ${to}:**\n\n` +
        top
          .map(
            (t) =>
              `• **${t.departure} → ${t.arrival}** | ${t.line} | Train #${t.trainNo} | Platform ${t.platform} | **${t.status}**${t.delayMin ? ` (+${t.delayMin}m)` : ""} | R${t.fare.toFixed(2)}`,
          )
          .join("\n")
      );
    }

    // Only one station mentioned — give useful info about it
    if (from) {
      const departures = SCHEDULES.filter((s) =>
        s.stops.map((x) => x.toLowerCase()).includes(from.toLowerCase()),
      ).slice(0, 4);
      if (departures.length > 0) {
        return (
          `**Services stopping at ${from}:**\n\n` +
          departures
            .map((t) => `• ${t.from} → ${t.to} | departs ${t.departure} | ${t.status}`)
            .join("\n") +
          `\n\nWhere are you heading to?`
        );
      }
      return `I found **${from}** station. Where are you heading to?`;
    }

    return "Which stations are you travelling between? E.g. \"Cape Town to Bellville\"";
  }

  // Stations list
  if (/(station|stop|line|network|route)/.test(lower)) {
    return `PRASA Metrorail Western Cape operates 4 lines:\n• **Southern Line** — Cape Town to Simon's Town\n• **Northern Line** — Cape Town to Bellville/Stellenbosch\n• **Central Line** — Cape Town to Khayelitsha\n• **Cape Flats Line** — Cape Town to Retreat\n\nMajor stations: ${["Cape Town", "Salt River", "Bellville", "Claremont", "Wynberg", "Muizenberg", "Khayelitsha", "Mitchells Plain"].join(", ")}`;
  }

  return "I can help with train schedules, delays, fares and alerts. Try: \"Next train from Cape Town to Khayelitsha\" or \"Are there delays today?\"";
}

export default router;

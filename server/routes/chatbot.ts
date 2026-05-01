import { Router } from "express";
import axios from "axios";
import { ChatbotSchema } from "../validate";
import { scrapeTrains } from "../scraper";
import { supabase } from "../db";
import { SCHEDULES, ALERTS } from "../../src/data/prasa";

const router = Router();

router.post("/", async (req, res) => {
  const parsed = ChatbotSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid message" });
    return;
  }

  const { message } = parsed.data;
  const apiKey = process.env.OPENAI_API_KEY;

  // Build context from all data sources
  const [scraped, recentUpdates] = await Promise.all([
    scrapeTrains(),
    supabase
      .from("train_updates")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(10)
      .then(({ data }) => data ?? []),
  ]);

  const scheduleSummary = SCHEDULES.map(
    (s) =>
      `Train #${s.trainNo} (${s.line}): ${s.from} → ${s.to}, departs ${s.departure}, arrives ${s.arrival}, status: ${s.status}${s.delayMin ? ` (+${s.delayMin}min)` : ""}, fare: R${s.fare}`,
  ).join("\n");

  const alertSummary = ALERTS.map(
    (a) => `[${a.level.toUpperCase()}] ${a.title}: ${a.message}`,
  ).join("\n");

  const scrapedSummary =
    scraped.length > 0
      ? scraped
          .map((s) => `LIVE: ${s.from} → ${s.to} at ${s.departure} — ${s.status}`)
          .join("\n")
      : "No live scraped data available.";

  const updateSummary =
    recentUpdates.length > 0
      ? recentUpdates
          .map(
            (u: any) =>
              `Admin update: Train #${u.train_no} at ${u.station} — ${u.status}${u.delay_min ? ` (+${u.delay_min}min)` : ""}${u.reason ? `, reason: ${u.reason}` : ""} (${new Date(u.updated_at).toLocaleString("en-ZA")})`,
          )
          .join("\n")
      : "No recent admin updates.";

  const systemPrompt = `You are a helpful PRASA Metrorail assistant for the Western Cape, South Africa.
Answer questions about train availability, delays, cancellations, fares, and route recommendations.
Be concise, friendly, and accurate. Always recommend the best train option when asked.
If a train is delayed or cancelled, explain the reason if known and suggest alternatives.

Current train schedules:
${scheduleSummary}

Active service alerts:
${alertSummary}

Live scraped data from cttrain.co.za:
${scrapedSummary}

Recent admin updates:
${updateSummary}`;

  // If no OpenAI key, fall back to rule-based response
  if (!apiKey) {
    const reply = ruleBasedReply(message, recentUpdates);
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
        max_tokens: 400,
        temperature: 0.4,
      },
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 15_000,
      },
    );

    const reply = response.data.choices[0]?.message?.content ?? "Sorry, I couldn't generate a response.";
    res.json({ reply });
  } catch (err) {
    console.error("OpenAI error:", (err as Error).message);
    // Graceful fallback
    const reply = ruleBasedReply(message, recentUpdates);
    res.json({ reply });
  }
});

function ruleBasedReply(message: string, updates: any[]): string {
  const lower = message.toLowerCase();

  if (updates.length > 0) {
    const relevant = updates.find(
      (u) =>
        lower.includes(u.station?.toLowerCase()) ||
        lower.includes(u.train_no?.toLowerCase()),
    );
    if (relevant) {
      return `Latest update for ${relevant.station}: Train #${relevant.train_no} is ${relevant.status}${relevant.delay_min ? ` (+${relevant.delay_min}min)` : ""}. ${relevant.reason ?? ""}`;
    }
  }

  if (/(delay|cancel|status)/.test(lower)) {
    const delayed = SCHEDULES.filter((s) => s.status !== "On Time");
    if (delayed.length === 0) return "All trains are currently running on time.";
    return (
      "Current disruptions:\n" +
      delayed
        .map(
          (s) =>
            `• Train #${s.trainNo} (${s.line}): ${s.status}${s.delayMin ? ` +${s.delayMin}min` : ""}`,
        )
        .join("\n")
    );
  }

  return "I can help with train schedules, delays, fares and route recommendations. Try asking: 'Next train from Cape Town to Bellville' or 'Are there delays today?'";
}

export default router;

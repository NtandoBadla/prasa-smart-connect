import axios from "axios";
import * as cheerio from "cheerio";
import { supabase } from "./db";

export interface ScrapedTrain {
  train_no: string;
  from_station: string;
  to_station: string;
  departure: string;
  arrival: string;
  status: string;
  line: string;
  delay_min: number;
  reason: string;
  scraped_at: string;
}

export interface ScrapedNotice {
  title: string;
  body: string;
  line: string;
  scraped_at: string;
}

const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; PRASA-Bot/1.0)" };
const TIMEOUT = 12_000;

const LINE_MAP: Record<string, string> = {
  southern: "Southern Line",
  northern: "Northern Line",
  central: "Central Line",
  "cape flats": "Cape Flats Line",
  capeflats: "Cape Flats Line",
  metrorail: "Metrorail",
};

function resolveLine(text: string): string {
  const lower = text.toLowerCase();
  for (const [key, val] of Object.entries(LINE_MAP)) {
    if (lower.includes(key)) return val;
  }
  return "Unknown";
}

function parseDelay(text: string): number {
  const m = text.match(/(\d+)\s*min/i);
  return m ? parseInt(m[1]) : 0;
}

// ── Scrape status2.php ────────────────────────────────────────────────────────
async function scrapeStatus(): Promise<{ trains: ScrapedTrain[]; notices: ScrapedNotice[] }> {
  const trains: ScrapedTrain[] = [];
  const notices: ScrapedNotice[] = [];
  const now = new Date().toISOString();

  try {
    const { data: html } = await axios.get("https://cttrains.co.za/status2.php", {
      headers: HEADERS,
      timeout: TIMEOUT,
    });
    const $ = cheerio.load(html);

    // Each line is a .rounded-xl card with an h2 (line name) and .msg-row children
    $(".rounded-xl").each((_i, card) => {
      const lineName = $(card).find("h2").first().text().trim();
      if (!lineName) return;

      const resolvedLine = resolveLine(lineName) !== "Unknown" ? resolveLine(lineName) : lineName;

      // Each update row: time in span.font-mono, message in p.msg-text
      $(card).find(".msg-row").each((_j, row) => {
        const time = $(row).find("span").first().text().trim();   // e.g. "14:30"
        const msg  = $(row).find("p").first().text().trim();      // e.g. "Inbound - T3212 departed..."
        if (!msg) return;

        // Detect status from message text
        let status = "Update";
        if (/(cancel|suspend|no service)/i.test(msg))  status = "Cancelled";
        else if (/(delay|late|slow)/i.test(msg))       status = "Delayed";
        else if (/(on time|normal|resumed)/i.test(msg)) status = "On Time";

        // Try to extract train number e.g. T3212
        const trainNoMatch = msg.match(/T(\d{3,5})/i);
        const trainNo = trainNoMatch ? trainNoMatch[0].toUpperCase() : "LIVE";

        // Try to extract station names from message
        const fromMatch = msg.match(/departed?\s+([A-Za-z ']+?)\s+station/i);
        const toMatch   = msg.match(/en[- ]?route\s+([A-Za-z ']+?)\s+station/i)
                       ?? msg.match(/to\s+([A-Za-z ']+?)\s+station/i);

        notices.push({
          title: `${resolvedLine} — ${time ? time + " — " : ""}${msg.slice(0, 100)}`,
          body: msg,
          line: resolvedLine,
          scraped_at: now,
        });

        trains.push({
          train_no: trainNo,
          from_station: fromMatch ? fromMatch[1].trim() : resolvedLine.replace(" Line", ""),
          to_station: toMatch ? toMatch[1].trim() : "Cape Town",
          departure: time || "",
          arrival: "",
          status,
          line: resolvedLine,
          delay_min: parseDelay(msg),
          reason: /(cable|signal|fault|theft|vandal|power)/i.test(msg) ? msg.slice(0, 120) : "",
          scraped_at: now,
        });
      });
    });

    console.log(`[scraper] status2.php → ${trains.length} trains, ${notices.length} notices`);
  } catch (err) {
    console.warn("[scraper] status2.php failed:", (err as Error).message);
  }

  return { trains, notices };
}

// ── Persist to Supabase ───────────────────────────────────────────────────────
async function persistToSupabase(trains: ScrapedTrain[], notices: ScrapedNotice[]) {
  if (trains.length > 0) {
    // Delete old scraped rows, insert fresh batch
    await supabase.from("scraped_trains").delete().lt("scraped_at", new Date(Date.now() - 30 * 60 * 1000).toISOString());
    const { error } = await supabase.from("scraped_trains").insert(trains);
    if (error) console.warn("[scraper] scraped_trains insert error:", error.message);
    else console.log(`[scraper] ✅ Upserted ${trains.length} trains`);
  }

  if (notices.length > 0) {
    await supabase.from("scraped_notices").delete().lt("scraped_at", new Date(Date.now() - 30 * 60 * 1000).toISOString());
    const { error } = await supabase.from("scraped_notices").insert(notices);
    if (error) console.warn("[scraper] scraped_notices insert error:", error.message);
    else console.log(`[scraper] ✅ Upserted ${notices.length} notices`);
  }
}

// ── In-memory cache (fallback when Supabase not configured) ──────────────────
let memCache: { trains: ScrapedTrain[]; notices: ScrapedNotice[]; fetchedAt: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000;

// ── Main scrape function (called by cron + chatbot) ───────────────────────────
export async function runScrape(): Promise<{ trains: ScrapedTrain[]; notices: ScrapedNotice[] }> {
  if (memCache && Date.now() - memCache.fetchedAt < CACHE_TTL) {
    return { trains: memCache.trains, notices: memCache.notices };
  }

  const { trains, notices } = await scrapeStatus();

  memCache = { trains, notices, fetchedAt: Date.now() };

  // Persist async — don't block response
  persistToSupabase(trains, notices).catch(() => {});

  return { trains, notices };
}

// ── Legacy export used by old chatbot code ────────────────────────────────────
export async function scrapeTrains() {
  const { trains } = await runScrape();
  return trains.map((t) => ({
    trainNo: t.train_no,
    from: t.from_station,
    to: t.to_station,
    departure: t.departure,
    arrival: t.arrival,
    status: t.status,
    line: t.line,
  }));
}

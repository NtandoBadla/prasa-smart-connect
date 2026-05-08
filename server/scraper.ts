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


    $(".rounded-xl").each((_i, card) => {
      const lineName = $(card).find("h2").first().text().trim();
      if (!lineName) return;

      const resolvedLine = resolveLine(lineName) !== "Unknown" ? resolveLine(lineName) : lineName;

      
      $(card).find(".msg-row").each((_j, row) => {
        const time = $(row).find("span").first().text().trim();   
        const msg  = $(row).find("p").first().text().trim();      
        if (!msg) return;

        
        let status = "Update";
        if (/(cancel|suspend|no service)/i.test(msg))  status = "Cancelled";
        else if (/(delay|late|slow)/i.test(msg))       status = "Delayed";
        else if (/(on time|normal|resumed)/i.test(msg)) status = "On Time";

        
        const trainNoMatch = msg.match(/T(\d{3,5})/i);
        const trainNo = trainNoMatch ? trainNoMatch[0].toUpperCase() : "LIVE";

    
        const fromMatch = msg.match(/departed?\s+([A-Za-z ']+?)\s+station/i)
                       ?? msg.match(/from\s+([A-Za-z ']+?)\s+(?:to|station)/i);
        const toMatch   = msg.match(/en[- ]?route\s+([A-Za-z ']+?)\s+station/i)
                       ?? msg.match(/to\s+([A-Za-z ']+?)(?:\s+station|$)/i);

        
        const KNOWN_STATIONS = ["Cape Town","Stellenbosch","Bellville","Parow","Goodwood","Salt River","Woodstock","Observatory","Mowbray","Rondebosch","Newlands","Claremont","Wynberg","Retreat","Muizenberg","Fish Hoek","Simon's Town","Khayelitsha","Mitchells Plain","Philippi","Nyanga","Langa","Pinelands","Nolungile","Mutual"];
        const mentionedStations = KNOWN_STATIONS.filter((s) => msg.toLowerCase().includes(s.toLowerCase()));

        const fromStation = fromMatch
          ? fromMatch[1].trim()
          : mentionedStations.length >= 2
            ? mentionedStations[0]
            : lineName !== "Advisories"
              ? resolvedLine.replace(" Line", "")
              : (mentionedStations[0] ?? "Unknown");

        const toStation = toMatch
          ? toMatch[1].trim()
          : mentionedStations.length >= 2
            ? mentionedStations[mentionedStations.length - 1]
            : "Cape Town";

        notices.push({
          title: `${resolvedLine} — ${time ? time + " — " : ""}${msg.slice(0, 100)}`,
          body: msg,
          line: resolvedLine,
          scraped_at: now,
        });

        trains.push({
          train_no: trainNo,
          from_station: fromStation,
          to_station: toStation,
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

async function persistToSupabase(trains: ScrapedTrain[], notices: ScrapedNotice[]) {
  if (trains.length > 0) {
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

let memCache: { trains: ScrapedTrain[]; notices: ScrapedNotice[]; fetchedAt: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000;


export async function runScrape(): Promise<{ trains: ScrapedTrain[]; notices: ScrapedNotice[] }> {
  if (memCache && Date.now() - memCache.fetchedAt < CACHE_TTL) {
    return { trains: memCache.trains, notices: memCache.notices };
  }

  const { trains, notices } = await scrapeStatus();

  memCache = { trains, notices, fetchedAt: Date.now() };

  persistToSupabase(trains, notices).catch(() => {});

  return { trains, notices };
}

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

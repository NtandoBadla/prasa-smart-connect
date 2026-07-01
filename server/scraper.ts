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


const KNOWN_STATIONS = [
  "Cape Town","Stellenbosch","Bellville","Parow","Goodwood","Salt River","Woodstock",
  "Observatory","Mowbray","Rondebosch","Newlands","Claremont","Wynberg","Retreat",
  "Muizenberg","Fish Hoek","Simon's Town","Khayelitsha","Mitchells Plain","Philippi",
  "Nyanga","Langa","Pinelands","Nolungile","Mutual","Chris Hani","Nonkqubela",
  "Mandalay","Stock Road","Bonteheuwel","Ysterplaat","Paarden Eiland","Esplanade",
  "Du Toit","Eerste River","Lynedoch","Vlottenburg","Kuils River","Blackheath",
  "Meltonrose","Elsies River","Vasco","Tygerberg","Thornton","Woltemade","Maitland",
  "Koeberg Road",
];

function extractTrainMessage(
  $: ReturnType<typeof cheerio.load>,
  msgEl: cheerio.Element,
  resolvedLine: string,
  lineName: string,
  now: string,
): { train: ScrapedTrain; notice: ScrapedNotice } | null {
  const time = $(msgEl).find("span, time, .time").first().text().trim();
  // Try multiple selectors for the message body
  const msg = (
    $(msgEl).find("p").first().text().trim() ||
    $(msgEl).find(".msg, .message, .body").first().text().trim() ||
    $(msgEl).clone().children("span, time").remove().end().text().trim()
  );
  if (!msg || msg.length < 5) return null;

  let status = "Update";
  if (/(cancel|suspend|no service)/i.test(msg))   status = "Cancelled";
  else if (/(delay|late|slow)/i.test(msg))        status = "Delayed";
  else if (/(on time|normal|resumed)/i.test(msg)) status = "On Time";

  const trainNoMatch = msg.match(/\bT(\d{3,5})\b/i);
  const trainNo = trainNoMatch ? trainNoMatch[0].toUpperCase() : "LIVE";

  // Match multi-word station names (e.g. "Du Toit", "Simon's Town", "Fish Hoek")
  const fromMatch = msg.match(/departed?\s+([A-Za-z '']+?)\s+station/i)
                 ?? msg.match(/from\s+([A-Za-z '']{3,}(?:\s+[A-Za-z '']+)?)\s+(?:to\b|station)/i);
  const toMatch   = msg.match(/en[- ]?route\s+to\s+([A-Za-z '']{3,}(?:\s+[A-Za-z '']+)?)\s*(?:station|[,(]|$)/i)
                 ?? msg.match(/\bto\s+([A-Za-z '']{3,}(?:\s+[A-Za-z '']+)?)(?:\s+station|[.,)]|$)/i);

  const mentionedStations = KNOWN_STATIONS.filter((s) =>
    msg.toLowerCase().includes(s.toLowerCase())
  );

  // Resolve a raw matched string to the nearest canonical station name
  function resolveStation(raw: string): string {
    const r = raw.trim();
    // Exact match first
    const exact = KNOWN_STATIONS.find((s) => s.toLowerCase() === r.toLowerCase());
    if (exact) return exact;
    // Starts-with match — handles truncated names like "Du" → "Du Toit"
    const starts = KNOWN_STATIONS.find((s) => s.toLowerCase().startsWith(r.toLowerCase()));
    if (starts) return starts;
    // Contains match
    const contains = KNOWN_STATIONS.find((s) => s.toLowerCase().includes(r.toLowerCase()));
    if (contains) return contains;
    return r;
  }

  const rawFrom = fromMatch
    ? fromMatch[1].trim()
    : mentionedStations.length >= 2
      ? mentionedStations[0]
      : lineName !== "Advisories"
        ? resolvedLine.replace(" Line", "")
        : (mentionedStations[0] ?? "Unknown");

  const rawTo = toMatch
    ? toMatch[1].trim()
    : mentionedStations.length >= 2
      ? mentionedStations[mentionedStations.length - 1]
      : "Cape Town";

  const fromStation = resolveStation(rawFrom);
  const toStation   = resolveStation(rawTo);

  return {
    notice: {
      title: `${resolvedLine} — ${time ? time + " — " : ""}${msg.slice(0, 100)}`,
      body: msg,
      line: resolvedLine,
      scraped_at: now,
    },
    train: {
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
    },
  };
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

    // Strategy 1: original selectors — .rounded-xl cards with .msg-row children
    let found = 0;
    $(".rounded-xl").each((_i, card) => {
      const lineName = $(card).find("h2").first().text().trim();
      if (!lineName) return;
      const resolvedLine = resolveLine(lineName) !== "Unknown" ? resolveLine(lineName) : lineName;

      $(card).find(".msg-row").each((_j, row) => {
        const result = extractTrainMessage($, row, resolvedLine, lineName, now);
        if (result) { trains.push(result.train); notices.push(result.notice); found++; }
      });
    });

    // Strategy 2: any card-like container with a heading and list items
    if (found === 0) {
      $("[class*='card'], [class*='panel'], section, article").each((_i, card) => {
        const heading = $(card).find("h1, h2, h3, h4").first().text().trim();
        if (!heading) return;
        const resolvedLine = resolveLine(heading) !== "Unknown" ? resolveLine(heading) : heading;

        $(card).find("li, [class*='row'], [class*='item'], [class*='msg']").each((_j, row) => {
          const result = extractTrainMessage($, row, resolvedLine, heading, now);
          if (result) { trains.push(result.train); notices.push(result.notice); found++; }
        });
      });
    }

    // Strategy 3: scan every <p> or <li> that mentions a known line keyword
    if (found === 0) {
      $("p, li").each((_i, el) => {
        const text = $(el).text().trim();
        if (text.length < 10) return;
        const resolvedLine = resolveLine(text);
        if (resolvedLine === "Unknown") return;
        const result = extractTrainMessage($, el, resolvedLine, resolvedLine, now);
        if (result) { trains.push(result.train); notices.push(result.notice); found++; }
      });
    }

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

  const { trains: scrapedTrains, notices: scrapedNotices } = await scrapeStatus();

  // If scraping returned nothing, synthesise live-style rows from the Supabase timetable
  // so the chatbot and live-trains endpoint always have something useful to show.
  let trains = scrapedTrains;
  let notices = scrapedNotices;

  if (trains.length === 0) {
    try {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      // Fetch the next ~30 departures across all routes from the official timetable
      const { data } = await supabase
        .from("prasa_timetable")
        .select("train_no, station_name, departure, platform, route_id, prasa_routes!inner(line_name, from_station, to_station)")
        .gte("departure", hhmm)
        .not("departure", "is", null)
        .order("departure", { ascending: true })
        .limit(30);

      if (data && data.length > 0) {
        // Group by (route_id, train_no) to pick origin station per train
        const seen = new Set<string>();
        for (const row of data as any[]) {
          const key = `${row.route_id}:${row.train_no}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const route = row.prasa_routes as any;
          const lineMap: Record<string, string> = {
            "Stellenbosch Line": "Stellenbosch Line",
            "Central Line": "Central Line",
            "Southern Line": "Southern Line",
            "Northern Line": "Northern Line",
            "Cape Flats Line": "Cape Flats Line",
          };
          trains.push({
            train_no: row.train_no,
            from_station: row.station_name,
            to_station: route?.to_station ?? "Cape Town",
            departure: row.departure,
            arrival: "",
            status: "On Time",
            line: lineMap[route?.line_name] ?? route?.line_name ?? "Unknown",
            delay_min: 0,
            reason: "",
            scraped_at: new Date().toISOString(),
          });
        }
        console.log(`[scraper] ℹ️  Scrape empty — synthesised ${trains.length} trains from timetable DB`);
      }
    } catch (err) {
      console.warn("[scraper] Timetable fallback failed:", (err as Error).message);
    }
  }

  memCache = { trains, notices, fetchedAt: Date.now() };
  persistToSupabase(scrapedTrains, scrapedNotices).catch(() => {});
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

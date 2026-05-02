import axios from "axios";
import * as cheerio from "cheerio";

export interface ScrapedTrain {
  trainNo: string;
  from: string;
  to: string;
  departure: string;
  arrival: string;
  status: string;
  line: string;
}

// Key stations to scrape from cttrain.co.za
const STATION_URLS: { url: string; station: string; line: string }[] = [
  { url: "https://cttrain.co.za/southern/capetown",    station: "Cape Town",    line: "Southern Line" },
  { url: "https://cttrain.co.za/southern/claremont",   station: "Claremont",    line: "Southern Line" },
  { url: "https://cttrain.co.za/southern/wynberg",     station: "Wynberg",      line: "Southern Line" },
  { url: "https://cttrain.co.za/southern/muizenberg",  station: "Muizenberg",   line: "Southern Line" },
  { url: "https://cttrain.co.za/southern/fishhoek",    station: "Fish Hoek",    line: "Southern Line" },
  { url: "https://cttrain.co.za/southern/simonstown",  station: "Simon's Town", line: "Southern Line" },
  { url: "https://cttrain.co.za/southern/steenberg",   station: "Steenberg",    line: "Southern Line" },
];

let cache: { data: ScrapedTrain[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function scrapeTrains(): Promise<ScrapedTrain[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  const results: ScrapedTrain[] = [];

  await Promise.allSettled(
    STATION_URLS.map(async ({ url, station, line }) => {
      try {
        const { data: html } = await axios.get(url, {
          timeout: 8_000,
          headers: { "User-Agent": "Mozilla/5.0 (compatible; PRASA-Bot/1.0)" },
        });
        const $ = cheerio.load(html);
        const parsed = parseStationPage($, station, line);
        results.push(...parsed);
      } catch {
        // silently skip failed stations
      }
    }),
  );

  cache = { data: results, fetchedAt: Date.now() };
  return results;
}

function parseStationPage($: cheerio.CheerioAPI, station: string, line: string): ScrapedTrain[] {
  const trains: ScrapedTrain[] = [];

  // cttrain.co.za lists trains in table rows or list items with time + destination + status
  $("table tr, .train, .service, .timetable-row").each((_i, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();

    // Match patterns like "06:15 Simon's Town On Time" or "07:05 Cape Town Delayed"
    const match = text.match(/(\d{2}:\d{2})\s+(.+?)\s+(On Time|Delayed|Cancelled)/i);
    if (match) {
      trains.push({
        trainNo: "LIVE",
        from: station,
        to: match[2].trim(),
        departure: match[1],
        arrival: "",
        status: match[3],
        line,
      });
    }
  });

  // Fallback: scan all text nodes for time patterns
  if (trains.length === 0) {
    const bodyText = $("body").text();
    const timeRegex = /(\d{2}:\d{2})\s+([A-Za-z' ]{3,30}?)\s+(On Time|Delayed|Cancelled)/gi;
    let m;
    while ((m = timeRegex.exec(bodyText)) !== null) {
      trains.push({
        trainNo: "LIVE",
        from: station,
        to: m[2].trim(),
        departure: m[1],
        arrival: "",
        status: m[3],
        line,
      });
    }
  }

  return trains;
}

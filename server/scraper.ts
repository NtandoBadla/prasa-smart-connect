import axios from "axios";

export interface ScrapedTrain {
  trainNo: string;
  from: string;
  to: string;
  departure: string;
  arrival: string;
  status: string;
  line: string;
}

let cache: { data: ScrapedTrain[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function scrapeTrains(): Promise<ScrapedTrain[]> {
  // Return cached data if still fresh
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    console.warn("SERPAPI_KEY not set — returning empty scrape results");
    return [];
  }

  try {
    const response = await axios.get("https://serpapi.com/search", {
      params: {
        engine: "google",
        q: "site:cttrain.co.za train schedule Cape Town",
        api_key: apiKey,
        num: 10,
      },
      timeout: 10_000,
    });

    const results: ScrapedTrain[] = [];
    const organicResults = response.data?.organic_results ?? [];

    for (const r of organicResults) {
      const snippet: string = r.snippet ?? "";
      // Parse patterns like "06:15 Cape Town → Simon's Town · On Time"
      const timePattern = /(\d{2}:\d{2})\s+([A-Za-z' ]+?)\s*[→\-]\s*([A-Za-z' ]+?)\s*[·•]\s*(On Time|Delayed|Cancelled)/gi;
      let match;
      while ((match = timePattern.exec(snippet)) !== null) {
        results.push({
          trainNo: "LIVE",
          from: match[2].trim(),
          to: match[3].trim(),
          departure: match[1],
          arrival: "",
          status: match[4],
          line: inferLine(match[2].trim(), match[3].trim()),
        });
      }
    }

    cache = { data: results, fetchedAt: Date.now() };
    return results;
  } catch (err) {
    console.error("SerpAPI scrape failed:", (err as Error).message);
    return cache?.data ?? [];
  }
}

function inferLine(from: string, to: string): string {
  const southern = ["Simon's Town", "Fish Hoek", "Muizenberg", "Wynberg", "Claremont", "Observatory"];
  const northern = ["Bellville", "Parow", "Goodwood", "Stellenbosch"];
  const central = ["Khayelitsha", "Mitchells Plain", "Philippi", "Nyanga", "Langa"];
  const flats = ["Retreat", "Pinelands"];

  const all = [from, to];
  if (all.some((s) => southern.includes(s))) return "Southern Line";
  if (all.some((s) => northern.includes(s))) return "Northern Line";
  if (all.some((s) => central.includes(s))) return "Central Line";
  if (all.some((s) => flats.includes(s))) return "Cape Flats Line";
  return "Unknown";
}

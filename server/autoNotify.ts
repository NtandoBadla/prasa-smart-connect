/**
 * autoNotify.ts
 *
 * Runs after each scrape cycle.
 * 1. Reads the latest scraped_trains / scraped_notices from Supabase.
 * 2. Compares against a "last seen" snapshot stored in the same DB table
 *    (scraped_trains_snapshot) to detect NEW delayed / cancelled trains.
 * 3. For each new event, resolves every station the train passes through.
 * 4. Looks up subscribers from BOTH `users` (users.station) AND the
 *    `subscriptions` table, then deduplicates by email.
 * 5. Sends email + SMS notifications via the existing mailer helpers.
 */

import { supabase } from "./db";
import { notifySubscribers, sendSms } from "./mailer";
import type { ScrapedTrain, ScrapedNotice } from "./scraper";

// ── Stations per line ─────────────────────────────────────────────────────────
const LINE_STOPS: Record<string, string[]> = {
  "Southern Line": [
    "Cape Town", "Woodstock", "Salt River", "Observatory", "Mowbray",
    "Rondebosch", "Newlands", "Claremont", "Wynberg", "Retreat",
    "Muizenberg", "Fish Hoek", "Simon's Town",
  ],
  "Northern Line": [
    "Cape Town", "Woodstock", "Salt River", "Pinelands", "Goodwood",
    "Parow", "Bellville", "Stellenbosch",
  ],
  "Central Line": [
    "Cape Town", "Esplanade", "Paarden Eiland", "Ysterplaat", "Mutual",
    "Langa", "Bonteheuwel", "Nyanga", "Philippi", "Mitchells Plain",
    "Khayelitsha", "Nonkqubela", "Nolungile", "Mandalay",
    "Stock Road", "Chris Hani",
  ],
  "Cape Flats Line": [
    "Cape Town", "Salt River", "Pinelands", "Nyanga", "Philippi", "Retreat",
  ],
};

/** All stations a train passes through (both directions). */
function affectedStations(train: ScrapedTrain): string[] {
  const stops = LINE_STOPS[train.line] ?? [];
  const fi = stops.findIndex((s) => s.toLowerCase() === train.from_station.toLowerCase());
  const ti = stops.findIndex((s) => s.toLowerCase() === train.to_station.toLowerCase());
  if (fi === -1 || ti === -1) {
    // Fallback: notify the specific stations we do know
    return [train.from_station, train.to_station].filter(Boolean);
  }
  const [start, end] = fi <= ti ? [fi, ti] : [ti, fi];
  return stops.slice(start, end + 1);
}

/** Build a deduplication key for a scrape event. */
function eventKey(train: ScrapedTrain): string {
  return `${train.train_no}|${train.status}|${train.delay_min}`;
}

// In-memory snapshot so we don't re-notify within the same process run.
// On cold start we rely on the DB snapshot for dedup.
const _inProcessSeen = new Set<string>();

/**
 * Fetch all subscribers (email + optional phone) for a given list of stations.
 * Combines users.station and the subscriptions table, deduped by email.
 */
async function getSubscribersForStations(
  stations: string[],
): Promise<{ email: string; phone?: string }[]> {
  const lower = stations.map((s) => s.toLowerCase());

  // 1. Users whose home station matches
  const { data: directUsers } = await supabase
    .from("users")
    .select("email, phone, station")
    .in("station", stations);

  // 2. Users who subscribed via /api/subscribe
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("station, user_id, users!inner(email, phone)")
    .in("station", stations);

  const map = new Map<string, { email: string; phone?: string }>();

  for (const u of directUsers ?? []) {
    if (u.email) map.set(u.email.toLowerCase(), { email: u.email, phone: u.phone ?? undefined });
  }

  for (const sub of subs ?? []) {
    const user = (sub as any).users as { email: string; phone?: string } | null;
    if (user?.email) {
      if (!map.has(user.email.toLowerCase())) {
        map.set(user.email.toLowerCase(), { email: user.email, phone: user.phone ?? undefined });
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Persist notification log so we can skip already-notified events.
 */
async function markNotified(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const rows = keys.map((k) => ({
    event_key: k,
    notified_at: new Date().toISOString(),
  }));
  await supabase
    .from("notification_log")
    .upsert(rows, { onConflict: "event_key" })
    .then(() => {})
    .catch((err: any) => console.warn("[autoNotify] notification_log upsert failed:", err.message));
}

/**
 * Return keys that have NOT been notified yet (checked against DB log).
 */
async function filterUnseen(keys: string[]): Promise<string[]> {
  if (keys.length === 0) return [];
  // Prune logs older than 2 hours so we re-notify if a train is still delayed next run
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  await supabase
    .from("notification_log")
    .delete()
    .lt("notified_at", twoHoursAgo)
    .then(() => {})
    .catch(() => {});

  const { data } = await supabase
    .from("notification_log")
    .select("event_key")
    .in("event_key", keys);

  const seen = new Set((data ?? []).map((r: any) => r.event_key as string));
  return keys.filter((k) => !seen.has(k) && !_inProcessSeen.has(k));
}

/**
 * Main entry point — call this after every scrape.
 */
export async function runAutoNotify(
  trains: ScrapedTrain[],
  _notices: ScrapedNotice[],
): Promise<{ notified: number; failed: number }> {
  // Only care about trains that are delayed or cancelled
  const actionable = trains.filter(
    (t) => t.status === "Delayed" || t.status === "Cancelled",
  );

  if (actionable.length === 0) {
    console.log("[autoNotify] No delayed/cancelled trains — nothing to notify.");
    return { notified: 0, failed: 0 };
  }

  // Deduplicate using event keys
  const keys = actionable.map(eventKey);
  const unseenKeys = await filterUnseen(keys);

  const unseenTrains = actionable.filter((t) => unseenKeys.includes(eventKey(t)));

  if (unseenTrains.length === 0) {
    console.log("[autoNotify] All events already notified — skipping.");
    return { notified: 0, failed: 0 };
  }

  let totalNotified = 0;
  let totalFailed = 0;
  const notifiedKeys: string[] = [];

  for (const train of unseenTrains) {
    const stations = affectedStations(train);
    console.log(
      `[autoNotify] Train ${train.train_no} (${train.status}) affects stations: ${stations.join(", ")}`,
    );

    const subscribers = await getSubscribersForStations(stations);
    if (subscribers.length === 0) {
      console.log(`[autoNotify] No subscribers for train ${train.train_no} stations.`);
      notifiedKeys.push(eventKey(train));
      _inProcessSeen.add(eventKey(train));
      continue;
    }

    const updatedAt = new Date().toLocaleString("en-ZA", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    // Email notifications
    const result = await notifySubscribers(subscribers, {
      trainNo: train.train_no,
      line: train.line,
      station: train.from_station,
      status: train.status,
      delayMin: train.delay_min,
      reason: train.reason || undefined,
      updatedAt,
    });
    totalNotified += result.sent;
    totalFailed += result.failed;

    // SMS notifications
    const smsText = buildSmsText(train);
    const smsResults = await Promise.allSettled(
      subscribers
        .filter((u) => !!u.phone)
        .map((u) => sendSms(u.phone!, smsText)),
    );
    const smsFailed = smsResults.filter((r) => r.status === "rejected").length;
    if (smsFailed > 0) {
      console.warn(`[autoNotify] ${smsFailed} SMS(es) failed for train ${train.train_no}`);
    }

    console.log(
      `[autoNotify] Train ${train.train_no}: notified ${result.sent} subscriber(s), ${result.failed} failed.`,
    );

    notifiedKeys.push(eventKey(train));
    _inProcessSeen.add(eventKey(train));
  }

  await markNotified(notifiedKeys);

  return { notified: totalNotified, failed: totalFailed };
}

function buildSmsText(train: ScrapedTrain): string {
  const base = `PRASA Alert: Train ${train.train_no} (${train.line})`;
  if (train.status === "Cancelled") {
    return `${base} has been CANCELLED between ${train.from_station} and ${train.to_station}.${train.reason ? ` Reason: ${train.reason}` : ""}`;
  }
  return `${base} is DELAYED by ${train.delay_min} min between ${train.from_station} and ${train.to_station}.${train.reason ? ` Reason: ${train.reason}` : ""}`;
}

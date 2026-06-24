// supabase/functions/notify-alert/index.ts
// Triggered by DB Webhook on scraped_trains INSERT or train_updates INSERT.
// Notifies ALL subscribers along the affected line, not just one station.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ── Line → stops map (mirrors src/data/prasa.ts) ─────────────────────────────
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
    "Chris Hani", "Khayelitsha", "Nonkqubela", "Nolungile", "Mandalay",
    "Stock Road", "Philippi", "Nyanga", "Bonteheuwel", "Langa",
    "Mutual", "Ysterplaat", "Paarden Eiland", "Esplanade", "Cape Town",
    // legacy short-route stations also on this line
    "Woodstock", "Salt River", "Mitchells Plain",
  ],
  "Cape Flats Line": [
    "Cape Town", "Salt River", "Pinelands", "Nyanga", "Philippi", "Retreat",
  ],
};

// Normalise line name variants from scraped data
function normaliseLine(raw: string): string {
  const l = raw?.toLowerCase() ?? "";
  if (l.includes("southern")) return "Southern Line";
  if (l.includes("northern") || l.includes("stellenbosch")) return "Northern Line";
  if (l.includes("cape flat")) return "Cape Flats Line";
  if (l.includes("central") || l.includes("khayelitsha") || l.includes("chris hani")) return "Central Line";
  return raw;
}

// Return all stations on a line; fall back to just the one affected station
function stationsForLine(line: string, fallback: string): string[] {
  const normalised = normaliseLine(line);
  return LINE_STOPS[normalised] ?? (fallback ? [fallback] : []);
}

// ── SMS helpers ───────────────────────────────────────────────────────────────
async function getSmsToken(): Promise<string> {
  const res = await fetch("https://rest.smsportal.com/v1/Authentication", {
    headers: {
      Authorization: `Basic ${btoa(`${Deno.env.get("SMSPORTAL_CLIENT_ID")}:${Deno.env.get("SMSPORTAL_CLIENT_SECRET")}`)}`,
    },
  });
  return (await res.json()).token as string;
}

function normaliseSAPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("27") && d.length === 11) return `+${d}`;
  if (d.startsWith("0") && d.length === 10) return `+27${d.slice(1)}`;
  return phone;
}

async function sendSms(token: string, phone: string, message: string) {
  await fetch("https://rest.smsportal.com/v1/BulkMessages", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ content: message, destination: normaliseSAPhone(phone) }] }),
  });
}

async function sendEmailJs(templateParams: Record<string, string>) {
  await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id:      Deno.env.get("EMAILJS_SERVICE_ID"),
      template_id:     Deno.env.get("EMAILJS_TEMPLATE_ID"),
      user_id:         Deno.env.get("EMAILJS_PUBLIC_KEY"),
      accessToken:     Deno.env.get("EMAILJS_PRIVATE_KEY"),
      template_params: templateParams,
    }),
  });
}

// ── Fetch related disruptions on the same line ────────────────────────────────
async function fetchLineContext(line: string, excludeId: string | number): Promise<string> {
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // last 2 hours

  const [{ data: trains }, { data: notices }] = await Promise.all([
    supabase
      .from("scraped_trains")
      .select("train_no, from_station, to_station, status, delay_min, reason")
      .eq("line", line)
      .in("status", ["Delayed", "Cancelled", "No Service"])
      .neq("id", excludeId)
      .gte("scraped_at", since)
      .limit(5),
    supabase
      .from("scraped_notices")
      .select("title, body")
      .ilike("line", `%${line}%`)
      .gte("scraped_at", since)
      .limit(3),
  ]);

  const parts: string[] = [];

  if (trains?.length) {
    parts.push(
      `Other disruptions on the ${line}:\n` +
      trains.map((t: any) =>
        `• Train ${t.train_no} (${t.from_station} → ${t.to_station}): ${t.status}${t.delay_min ? ` +${t.delay_min}min` : ""}${t.reason ? ` — ${t.reason}` : ""}`
      ).join("\n")
    );
  }

  if (notices?.length) {
    parts.push(
      `Service notices:\n` +
      notices.map((n: any) => `• ${n.title ?? n.body}`).join("\n")
    );
  }

  return parts.join("\n\n");
}

serve(async (req) => {
  const body = await req.json();
  const record = body.record ?? body;
  const { train_no, line: rawLine, status, delay_min, reason, from_station, station } = record;

  // Only alert on actionable statuses
  if (!["Delayed", "Cancelled", "No Service"].includes(status)) {
    return new Response(JSON.stringify({ skipped: true }), { status: 200 });
  }

  const line = normaliseLine(rawLine ?? "");
  const triggerStation: string = station ?? from_station ?? "";
  const affectedStations = stationsForLine(line, triggerStation);

  // Fetch all subscribers at any station on this line (deduplicated by email/phone)
  const { data: users } = await supabase
    .from("users")
    .select("email, phone, station")
    .in("station", affectedStations);

  if (!users?.length) {
    await supabase.from("automation_logs").insert({
      event_type: "alert_sent", entity_type: "train_update",
      entity_id: String(record.id ?? ""),
      payload: { train_no, line, affectedStations, notified: 0, reason: "no_subscribers" },
      status: "ok",
    });
    return new Response(JSON.stringify({ notified: 0, affectedStations }), { status: 200 });
  }

  // Deduplicate — one user may be subscribed to multiple stations on the same line
  const seen = new Set<string>();
  const uniqueUsers = users.filter((u: any) => {
    const key = u.email ?? u.phone;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const updatedAt = new Date().toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
  const statusLabel = status === "Delayed" ? `Delayed by ${delay_min ?? 0} min` : status;
  const lineContext = await fetchLineContext(line, record.id ?? -1);

  const smsText = [
    `PRASA Alert [${line}]: Train ${train_no} — ${statusLabel}`,
    reason ? reason : null,
    `Affects: ${affectedStations.slice(0, 4).join(", ")}${affectedStations.length > 4 ? ` +${affectedStations.length - 4} more` : ""}`,
    updatedAt,
  ].filter(Boolean).join(". ");

  let smsToken: string | null = null;
  if (Deno.env.get("SMSPORTAL_CLIENT_ID") && Deno.env.get("SMSPORTAL_CLIENT_SECRET")) {
    try { smsToken = await getSmsToken(); } catch { /* non-fatal */ }
  }

  let emailSent = 0, smsSent = 0;

  await Promise.allSettled(uniqueUsers.map(async (u: any) => {
    if (u.email) {
      try {
        await sendEmailJs({
          to_email:    u.email,
          train_no,
          line,
          station:     u.station,           // their subscribed station
          status:      statusLabel,
          reason:      reason ?? "No reason provided",
          updated_at:  updatedAt,
          line_context: lineContext || "No additional disruptions on this line.",
          affected_stations: affectedStations.join(", "),
        });
        emailSent++;
      } catch { /* non-fatal */ }
    }
    if (smsToken && u.phone) {
      try { await sendSms(smsToken, u.phone, smsText); smsSent++; } catch { /* non-fatal */ }
    }
  }));

  await supabase.from("automation_logs").insert({
    event_type: "alert_sent", entity_type: "train_update",
    entity_id: String(record.id ?? ""),
    payload: {
      train_no, line, status, triggerStation,
      affectedStations, subscribersFound: users.length,
      uniqueNotified: uniqueUsers.length, emailSent, smsSent,
    },
    status: "ok",
  });

  return new Response(
    JSON.stringify({ emailSent, smsSent, affectedStations, uniqueNotified: uniqueUsers.length }),
    { status: 200 },
  );
});

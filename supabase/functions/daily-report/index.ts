// supabase/functions/daily-report/index.ts
// Invoked by Supabase Cron (pg_cron) every day at 04:00 UTC (06:00 SAST).
// Aggregates stats and writes to daily_reports + emails all admin addresses.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function sendEmailJs(templateParams: Record<string, string>) {
  await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id:      Deno.env.get("EMAILJS_SERVICE_ID"),
      template_id:     Deno.env.get("EMAILJS_REPORT_TEMPLATE_ID") ?? Deno.env.get("EMAILJS_TEMPLATE_ID"),
      user_id:         Deno.env.get("EMAILJS_PUBLIC_KEY"),
      accessToken:     Deno.env.get("EMAILJS_PRIVATE_KEY"),
      template_params: templateParams,
    }),
  });
}

serve(async () => {
  const today     = new Date();
  const reportDate = today.toISOString().slice(0, 10);
  const yesterday  = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const from = yesterday.toISOString();

  // ── Collect stats ────────────────────────────────────────────────────────
  const [
    { count: ticketsIssued },
    { count: ticketsUsed },
    { count: ticketsExpired },
    { data: delays },
    { count: safetyIncidents },
    { count: lostOpen },
    { count: lostMatched },
    { data: crowding },
  ] = await Promise.all([
    supabase.from("tickets").select("*", { count: "exact", head: true }).gte("booked_at", from),
    supabase.from("tickets").select("*", { count: "exact", head: true }).eq("used", true).gte("used_at", from),
    supabase.from("automation_logs").select("*", { count: "exact", head: true }).eq("event_type", "ticket_expired").gte("created_at", from),
    supabase.from("train_updates").select("delay_min, line").gte("updated_at", from),
    supabase.from("safety_incidents").select("*", { count: "exact", head: true }).gte("created_at", from),
    supabase.from("lost_found").select("*", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("lost_found").select("*", { count: "exact", head: true }).eq("status", "matched").gte("created_at", from),
    supabase.from("crowding_predictions").select("crowding_score, line"),
  ]);

  const delayRows   = delays ?? [];
  const totalDelays = delayRows.length;
  const avgDelayMin = totalDelays
    ? Math.round(delayRows.reduce((s: number, r: any) => s + (r.delay_min ?? 0), 0) / totalDelays)
    : 0;

  // Most delayed line
  const lineCounts: Record<string, number> = {};
  for (const r of delayRows as any[]) {
    if (r.line) lineCounts[r.line] = (lineCounts[r.line] ?? 0) + 1;
  }
  const topDelayedLine = Object.entries(lineCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "N/A";

  const crowdingRows = crowding ?? [];
  const crowdingAvg  = crowdingRows.length
    ? Math.round(crowdingRows.reduce((s: number, r: any) => s + (r.crowding_score ?? 0), 0) / crowdingRows.length)
    : 0;

  const reportJson = {
    report_date:        reportDate,
    tickets_issued:     ticketsIssued ?? 0,
    tickets_used:       ticketsUsed ?? 0,
    tickets_expired:    ticketsExpired ?? 0,
    total_delays:       totalDelays,
    avg_delay_min:      avgDelayMin,
    safety_incidents:   safetyIncidents ?? 0,
    lost_found_open:    lostOpen ?? 0,
    lost_found_matched: lostMatched ?? 0,
    crowding_avg:       crowdingAvg,
    top_delayed_line:   topDelayedLine,
  };

  // ── Persist report ───────────────────────────────────────────────────────
  await supabase.from("daily_reports").upsert(
    { ...reportJson, report_json: reportJson },
    { onConflict: "report_date" }
  );

  // ── Email report to admin ─────────────────────────────────────────────────
  const adminEmail = Deno.env.get("ADMIN_EMAIL");
  if (adminEmail) {
    try {
      await sendEmailJs({
        to_email:           adminEmail,
        report_date:        reportDate,
        tickets_issued:     String(reportJson.tickets_issued),
        tickets_used:       String(reportJson.tickets_used),
        tickets_expired:    String(reportJson.tickets_expired),
        total_delays:       String(reportJson.total_delays),
        avg_delay_min:      String(reportJson.avg_delay_min),
        safety_incidents:   String(reportJson.safety_incidents),
        lost_found_open:    String(reportJson.lost_found_open),
        lost_found_matched: String(reportJson.lost_found_matched),
        crowding_avg:       String(reportJson.crowding_avg),
        top_delayed_line:   reportJson.top_delayed_line,
      });
    } catch { /* non-fatal */ }
  }

  // ── Audit log ────────────────────────────────────────────────────────────
  await supabase.from("automation_logs").insert({
    event_type: "report_generated", entity_type: "daily_reports",
    entity_id: reportDate, payload: reportJson, status: "ok",
  });

  return new Response(JSON.stringify(reportJson), { status: 200 });
});

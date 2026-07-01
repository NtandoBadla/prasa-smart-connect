/**
 * server/automation.ts
 *
 * All scheduled background automation for PRASA Smart Connect.
 * Imported once by server/index.ts — call startAutomation() after the Express
 * server starts.
 *
 * Jobs:
 *  • Every 10 min  — scrape trains, detect delays/cancellations, notify subscribers
 *  • Every 5 min   — expire tickets whose expires_at has passed
 *  • Every day 06:00 SAST — invoke daily-report Edge Function
 */

import cron from "node-cron";
import { supabase } from "./db";
import { runScrape } from "./scraper";
import { runAutoNotify } from "./autoNotify";
import { sendEmail, sendSms } from "./mailer";

// ── Audit logger ──────────────────────────────────────────────────────────────

async function auditLog(
  eventType: string,
  entityType: string,
  entityId: string,
  payload: unknown,
  status: "ok" | "error" = "ok",
  errorMsg?: string,
) {
  try {
    await supabase.from("automation_logs").insert({
      event_type:  eventType,
      entity_type: entityType,
      entity_id:   entityId,
      payload:     payload as any,
      status,
      error_msg:   errorMsg ?? null,
    });
  } catch { /* non-fatal — never let logging crash a job */ }
}

// ── Job 1: Scrape + alert subscribers on delays / cancellations ───────────────
// Delegates to autoNotify.ts which handles deduplication, subscriptions table
// lookup, and fan-out to both email and SMS.

async function jobScrapeAndAlert() {
  try {
    const { trains, notices } = await runScrape();
    const { notified, failed } = await runAutoNotify(trains, notices);
    if (notified > 0 || failed > 0) {
      console.log(`[automation] scrape+alert: notified=${notified} failed=${failed}`);
    }
    await auditLog("alert_sent", "scraped_trains", "cron", {
      trains: trains.length, notified, failed,
    });
  } catch (err: any) {
    await auditLog("alert_sent", "scraped_trains", "cron", {}, "error", err.message);
    console.error("[automation] jobScrapeAndAlert failed:", err.message);
  }
}

// ── Job 2: Expire tickets ─────────────────────────────────────────────────────

async function jobExpireTickets() {
  try {
    const now = new Date().toISOString();

    // Fetch expired but not-yet-marked tickets
    const { data: expiredTickets, error } = await supabase
      .from("tickets")
      .select("id, ticket_ref, email, phone, passenger_name, expires_at")
      .lt("expires_at", now)
      .eq("used", false)
      .eq("payment_status", "paid");

    if (error) throw new Error(error.message);
    if (!expiredTickets?.length) return;

    // Batch-update to mark as used (the SQL trigger fn_expire_ticket also fires)
    const ids = expiredTickets.map((t: any) => t.id);
    await supabase
      .from("tickets")
      .update({ used: true, used_at: now })
      .in("id", ids);

    // Notify each passenger
    for (const ticket of expiredTickets as any[]) {
      if (ticket.email) {
        try {
          await sendEmail({
            to: ticket.email,
            subject: `Your PRASA Ticket ${ticket.ticket_ref} has expired`,
            html: "",
            templateParams: {
              to_email:       ticket.email,
              ticket_ref:     ticket.ticket_ref,
              passenger_name: ticket.passenger_name ?? "Passenger",
              expires_at:     new Date(ticket.expires_at).toLocaleString("en-ZA"),
            },
          });
        } catch { /* non-fatal */ }
      }
      if (ticket.phone) {
        try {
          await sendSms(
            ticket.phone,
            `PRASA: Your ticket ${ticket.ticket_ref} expired on ${new Date(ticket.expires_at).toLocaleString("en-ZA")}. Book a new ticket at prasa.gov.za.`,
          );
        } catch { /* non-fatal */ }
      }
      await auditLog("ticket_expired", "ticket", ticket.id, {
        ticket_ref: ticket.ticket_ref, expires_at: ticket.expires_at,
      });
    }

    console.log(`[automation] Expired ${expiredTickets.length} ticket(s)`);
  } catch (err: any) {
    await auditLog("ticket_expired", "ticket", "batch", {}, "error", err.message);
    console.error("[automation] jobExpireTickets failed:", err.message);
  }
}

// ── Job 3: Daily report (calls Supabase Edge Function) ────────────────────────

async function jobDailyReport() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) return;

  try {
    const url = `${supabaseUrl}/functions/v1/daily-report`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ triggered_by: "node-cron" }),
    });
    const data = await res.json();
    console.log("[automation] Daily report generated:", data?.report_date ?? data);
    await auditLog("report_generated", "daily_reports", data?.report_date ?? "unknown", data);
  } catch (err: any) {
    await auditLog("report_generated", "daily_reports", "cron", {}, "error", err.message);
    console.error("[automation] jobDailyReport failed:", err.message);
  }
}

// ── Start all cron jobs ───────────────────────────────────────────────────────

export function startAutomation() {
  // Scrape + alert — every 10 minutes (aligned with existing scraper cron)
  cron.schedule("*/10 * * * *", jobScrapeAndAlert);

  // Ticket expiry — every 5 minutes
  cron.schedule("*/5 * * * *", jobExpireTickets);

  // Daily report — 04:00 UTC = 06:00 SAST
  cron.schedule("0 4 * * *", jobDailyReport);

  console.log("[automation] ✅ Cron jobs started: scrape+alert (10m), ticket-expiry (5m), daily-report (04:00 UTC)");
}

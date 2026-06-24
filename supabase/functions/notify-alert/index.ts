// supabase/functions/notify-alert/index.ts
// Triggered by Supabase DB Webhook on scraped_trains INSERT or train_updates INSERT.
// Sends email (EmailJS) + SMS (SMSPortal) to subscribers at the affected station.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function getSmsToken(): Promise<string> {
  const res = await fetch("https://rest.smsportal.com/v1/Authentication", {
    headers: {
      Authorization: `Basic ${btoa(`${Deno.env.get("SMSPORTAL_CLIENT_ID")}:${Deno.env.get("SMSPORTAL_CLIENT_SECRET")}`)}`,
    },
  });
  const data = await res.json();
  return data.token as string;
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
      service_id:    Deno.env.get("EMAILJS_SERVICE_ID"),
      template_id:   Deno.env.get("EMAILJS_TEMPLATE_ID"),
      user_id:       Deno.env.get("EMAILJS_PUBLIC_KEY"),
      accessToken:   Deno.env.get("EMAILJS_PRIVATE_KEY"),
      template_params: templateParams,
    }),
  });
}

async function logEvent(eventType: string, entityId: string, payload: unknown, status = "ok", errorMsg?: string) {
  await supabase.from("automation_logs").insert({
    event_type: eventType, entity_type: "train_update",
    entity_id: String(entityId), payload, status, error_msg: errorMsg ?? null,
  });
}

serve(async (req) => {
  const body = await req.json();
  // Supabase DB Webhook payload: { type: 'INSERT', table, record }
  const record = body.record ?? body;
  const { train_no, line, status, delay_min, reason, from_station, station } = record;
  const affectedStation: string = station ?? from_station ?? "";

  // Only alert on actionable statuses
  if (!["Delayed", "Cancelled", "No Service"].includes(status)) {
    return new Response(JSON.stringify({ skipped: true }), { status: 200 });
  }

  // Fetch subscribers at this station
  const { data: users } = await supabase
    .from("users")
    .select("email, phone")
    .eq("station", affectedStation);

  if (!users?.length) {
    return new Response(JSON.stringify({ notified: 0 }), { status: 200 });
  }

  const updatedAt = new Date().toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
  const statusLabel = status === "Delayed" ? `Delayed by ${delay_min ?? 0} min` : status;
  const smsText = `PRASA Alert: Train ${train_no} (${line}) at ${affectedStation} — ${statusLabel}${reason ? `. ${reason}` : ""}. ${updatedAt}`;

  let smsToken: string | null = null;
  const hasSmsCredentials = Deno.env.get("SMSPORTAL_CLIENT_ID") && Deno.env.get("SMSPORTAL_CLIENT_SECRET");
  if (hasSmsCredentials) {
    try { smsToken = await getSmsToken(); } catch { /* non-fatal */ }
  }

  let emailSent = 0, smsSent = 0;

  await Promise.allSettled(users.map(async (u: any) => {
    if (u.email) {
      try {
        await sendEmailJs({
          to_email: u.email, train_no, line, station: affectedStation,
          status: statusLabel, reason: reason ?? "No reason provided", updated_at: updatedAt,
        });
        emailSent++;
      } catch { /* non-fatal */ }
    }
    if (smsToken && u.phone) {
      try { await sendSms(smsToken, u.phone, smsText); smsSent++; } catch { /* non-fatal */ }
    }
  }));

  await logEvent("alert_sent", String(record.id ?? ""), { train_no, line, station: affectedStation, status, emailSent, smsSent });

  return new Response(JSON.stringify({ emailSent, smsSent }), { status: 200 });
});

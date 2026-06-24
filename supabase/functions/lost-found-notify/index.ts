// supabase/functions/lost-found-notify/index.ts
// Triggered by Supabase DB Webhook on lost_found UPDATE where status = 'matched'.
// Notifies the passenger via EmailJS email and SMSPortal SMS.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function normaliseSAPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("27") && d.length === 11) return `+${d}`;
  if (d.startsWith("0") && d.length === 10) return `+27${d.slice(1)}`;
  return phone;
}

serve(async (req) => {
  const body = await req.json();
  const { record, old_record } = body;

  // Only fire when transitioning to 'matched'
  if (record?.status !== "matched" || old_record?.status === "matched") {
    return new Response(JSON.stringify({ skipped: true }), { status: 200 });
  }

  const { id, item, station, date, contact, contact_ref } = record;
  const foundDate = new Date().toLocaleDateString("en-ZA");
  const itemDate  = new Date(date).toLocaleDateString("en-ZA");

  const notified: string[] = [];

  // Email via EmailJS
  if (contact && contact.includes("@")) {
    try {
      await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id:  Deno.env.get("EMAILJS_SERVICE_ID"),
          template_id: Deno.env.get("EMAILJS_FOUND_TEMPLATE_ID") ?? Deno.env.get("EMAILJS_TEMPLATE_ID"),
          user_id:     Deno.env.get("EMAILJS_PUBLIC_KEY"),
          accessToken: Deno.env.get("EMAILJS_PRIVATE_KEY"),
          template_params: {
            to_email: contact, contact_ref, item,
            station, date: itemDate, found_date: foundDate,
          },
        }),
      });
      notified.push("email");
    } catch { /* non-fatal */ }
  }

  // SMS via SMSPortal (contact may also be a phone number)
  const isPhone = /^\+?[\d\s\-()]{7,}$/.test(contact) && !contact.includes("@");
  if (isPhone) {
    const clientId     = Deno.env.get("SMSPORTAL_CLIENT_ID");
    const clientSecret = Deno.env.get("SMSPORTAL_CLIENT_SECRET");
    if (clientId && clientSecret) {
      try {
        const authRes = await fetch("https://rest.smsportal.com/v1/Authentication", {
          headers: { Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}` },
        });
        const { token } = await authRes.json();
        const msg = `PRASA Lost & Found: Your item "${item}" reported at ${station} on ${itemDate} has been found! Ref: ${contact_ref}. Contact the station to collect.`;
        await fetch("https://rest.smsportal.com/v1/BulkMessages", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [{ content: msg, destination: normaliseSAPhone(contact) }] }),
        });
        notified.push("sms");
      } catch { /* non-fatal */ }
    }
  }

  // Audit log
  await supabase.from("automation_logs").insert({
    event_type: "lost_found_notified", entity_type: "lost_found",
    entity_id: String(id),
    payload: { item, station, contact_ref, notified },
    status: "ok",
  });

  return new Response(JSON.stringify({ notified }), { status: 200 });
});

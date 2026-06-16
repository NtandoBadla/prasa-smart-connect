import { Router } from "express";
import { randomUUID, randomBytes } from "crypto";
import Stripe from "stripe";
import { supabase } from "../db";
import { sendEmail, sendSms } from "../mailer";

const router = Router();

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTicketRef(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = randomBytes(2).toString("hex").toUpperCase();
  return `TKT-${ts}-${rnd}`;
}

function makeQrToken(): string {
  return randomBytes(32).toString("hex");
}

const TICKET_SELECT = "id, ticket_ref, qr_token, user_id, passenger_name, id_number, phone, email, train_no, line, from_station, to_station, departure, arrival, fare, travel_class, payment_intent_id, payment_status, used, used_at, booked_at";

function ticketSmsText(t: any): string {
  return `PRASA Ticket ${t.ticket_ref}\n${t.from_station} -> ${t.to_station} | Train ${t.train_no}\nDeparts: ${t.departure} | ${t.travel_class}\nFare: R${Number(t.fare).toFixed(2)} | ${t.payment_status.toUpperCase()}\nPresent this ref at boarding.`;
}

// ── POST /api/tickets/create-payment-intent ───────────────────────────────────
// Creates a Stripe PaymentIntent and a pending ticket record.
// Returns { clientSecret, ticketId } to the frontend.
router.post("/create-payment-intent", async (req, res) => {
  if (!stripe) {
    res.status(503).json({ error: "Stripe is not configured (STRIPE_SECRET_KEY missing)" });
    return;
  }

  const { userId, trainNo, line, from, to, departure, arrival, fare, travelClass,
          passengerName, idNumber, phone, email } = req.body as {
    userId?: string;
    trainNo: string;
    line: string;
    from: string;
    to: string;
    departure: string;
    arrival: string;
    fare: number;
    travelClass?: string;
    passengerName?: string;
    idNumber?: string;
    phone?: string;
    email?: string;
  };

  if (!trainNo || !from || !to || !departure || !fare) {
    res.status(400).json({ error: "trainNo, from, to, departure, fare required" });
    return;
  }

  // Amount in cents (ZAR → rands × 100)
  const amountCents = Math.round(fare * 100);

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "zar",
      metadata: { trainNo, line, from, to, departure },
      description: `PRASA ticket: ${from} → ${to} Train #${trainNo}`,
    });

    // Create a PENDING ticket — not valid until payment confirmed
    const ticketId = randomUUID();
    const ticketRef = makeTicketRef();
    const qrToken = makeQrToken();

    const { error: dbError } = await supabase.from("tickets").insert({
      id: ticketId,
      ticket_ref: ticketRef,
      qr_token: qrToken,
      user_id: userId ?? null,
      passenger_name: passengerName ?? null,
      id_number: idNumber ?? null,
      phone: phone ?? null,
      email: email ?? null,
      train_no: trainNo,
      line,
      from_station: from,
      to_station: to,
      departure,
      arrival,
      fare,
      travel_class: travelClass ?? "Metro",
      payment_intent_id: paymentIntent.id,
      payment_status: "pending",
      used: false,
      booked_at: new Date().toISOString(),
    });

    if (dbError) {
      console.error("Ticket insert error:", dbError.message);
      res.status(500).json({ error: "Failed to create ticket record" });
      return;
    }

    res.json({ clientSecret: paymentIntent.client_secret, ticketId, ticketRef });
  } catch (err: any) {
    console.error("Stripe error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/tickets/confirm-payment ─────────────────────────────────────────
// Called after Stripe confirms payment on the client.
// Verifies the PaymentIntent status with Stripe, then marks ticket as paid.
router.post("/confirm-payment", async (req, res) => {
  if (!stripe) {
    res.status(503).json({ error: "Stripe not configured" });
    return;
  }

  const { paymentIntentId } = req.body as { paymentIntentId: string };
  if (!paymentIntentId) {
    res.status(400).json({ error: "paymentIntentId required" });
    return;
  }

  try {
    // Verify with Stripe directly — never trust the client
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (intent.status !== "succeeded") {
      res.status(402).json({ error: `Payment not successful: ${intent.status}` });
      return;
    }

    // Mark ticket as paid
    const { data, error } = await supabase
      .from("tickets")
      .update({ payment_status: "paid" })
      .eq("payment_intent_id", paymentIntentId)
      .eq("payment_status", "pending") // guard: only update pending tickets
      .select("id, ticket_ref, qr_token, train_no, line, from_station, to_station, departure, arrival, fare, travel_class, booked_at")
      .single();

    if (error || !data) {
      res.status(404).json({ error: "Ticket not found or already confirmed" });
      return;
    }

    res.json(data);
  } catch (err: any) {
    console.error("Confirm payment error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/tickets/validate ────────────────────────────────────────────────
// Used by station inspectors / gate scanners.
// Accepts a qr_token, marks the ticket as used exactly once.
router.post("/validate", async (req, res) => {
  const { qrToken } = req.body as { qrToken: string };
  if (!qrToken) {
    res.status(400).json({ error: "qrToken required" });
    return;
  }

  const { data: ticket, error: fetchErr } = await supabase
    .from("tickets")
    .select("id, ticket_ref, from_station, to_station, departure, line, payment_status, used, used_at")
    .eq("qr_token", qrToken)
    .single();

  if (fetchErr || !ticket) {
    res.status(404).json({ valid: false, reason: "Ticket not found" });
    return;
  }

  if (ticket.payment_status !== "paid") {
    res.status(402).json({ valid: false, reason: "Ticket has not been paid for" });
    return;
  }

  if (ticket.used) {
    res.status(409).json({
      valid: false,
      reason: "Ticket already used",
      used_at: ticket.used_at,
    });
    return;
  }

  // Mark as used atomically
  const { error: updateErr } = await supabase
    .from("tickets")
    .update({ used: true, used_at: new Date().toISOString() })
    .eq("id", ticket.id)
    .eq("used", false); // extra guard against race condition

  if (updateErr) {
    res.status(500).json({ valid: false, reason: "Failed to validate ticket" });
    return;
  }

  res.json({
    valid: true,
    ticket_ref: ticket.ticket_ref,
    from_station: ticket.from_station,
    to_station: ticket.to_station,
    departure: ticket.departure,
    line: ticket.line,
  });
});

// ── POST /api/tickets/generate ──────────────────────────────────────────────
// Free ticket generation — no Stripe required.
router.post("/generate", async (req, res) => {
  const { userId, trainNo, line, from, to, departure, arrival, fare, travelClass,
          passengerName, idNumber, phone, email } = req.body as {
    userId?: string;
    trainNo: string;
    line: string;
    from: string;
    to: string;
    departure: string;
    arrival: string;
    fare?: number;
    travelClass?: string;
    passengerName?: string;
    idNumber?: string;
    phone?: string;
    email?: string;
  };

  if (!trainNo || !from || !to || !departure) {
    res.status(400).json({ error: "trainNo, from, to, departure required" });
    return;
  }

  const ticketId = randomUUID();
  const ticketRef = makeTicketRef();
  const qrToken = makeQrToken();

  const { data, error: dbError } = await supabase.from("tickets").insert({
    id: ticketId,
    ticket_ref: ticketRef,
    qr_token: qrToken,
    user_id: userId ?? null,
    passenger_name: passengerName ?? null,
    id_number: idNumber ?? null,
    phone: phone ?? null,
    email: email ?? null,
    train_no: trainNo,
    line,
    from_station: from,
    to_station: to,
    departure,
    arrival: arrival ?? null,
    fare: fare ?? 0,
    travel_class: travelClass ?? "Metro",
    payment_status: "paid",
    used: false,
    booked_at: new Date().toISOString(),
  }).select(TICKET_SELECT).single();

  if (dbError) {
    console.error("Ticket insert error:", dbError.message);
    res.status(500).json({ error: "Failed to create ticket record" });
    return;
  }

  res.status(201).json(data);
});

// ── GET /api/tickets/timetable ────────────────────────────────────────────────
router.get("/timetable", async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("timetable")
      .select("*")
      .order("departure", { ascending: true });
    if (error) { res.json([]); return; }
    res.json(data ?? []);
  } catch {
    res.json([]);
  }
});

// ── POST /api/tickets/timetable ───────────────────────────────────────────────
router.post("/timetable", async (req, res) => {
  const entry = { ...req.body, id: randomUUID(), created_at: new Date().toISOString() };
  try {
    const { error } = await supabase.from("timetable").insert(entry);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(201).json(entry);
  } catch {
    res.status(500).json({ error: "DB unavailable" });
  }
});

// ── GET /api/tickets/ref/:ticketRef ──────────────────────────────────────────
// Public endpoint — passenger looks up their own ticket by reference code.
// Returns the ticket WITHOUT the qr_token (qr_token is only embedded in the QR
// image generated client-side from the stored value).
router.get("/ref/:ticketRef", async (req, res) => {
  const { ticketRef } = req.params;
  const { data, error } = await supabase
    .from("tickets")
    .select(TICKET_SELECT)
    .eq("ticket_ref", ticketRef.trim().toUpperCase())
    .single();

  if (error || !data) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  res.json(data);
});

// ── GET /api/tickets/ref/:ticketRef ──────────────────────────────────────────
// Public lookup by ticket reference — for passengers to view their ticket
router.get("/ref/:ticketRef", async (req, res) => {
  const { ticketRef } = req.params;
  const { data, error } = await supabase
    .from("tickets")
    .select(TICKET_SELECT)
    .ilike("ticket_ref", ticketRef.trim())
    .single();
  if (error || !data) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  res.json(data);
});

// ── GET /api/tickets/:userId ──────────────────────────────────────────────────
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const { data, error } = await supabase
      .from("tickets")
      .select(TICKET_SELECT)
      .eq("user_id", userId)
      .eq("payment_status", "paid")
      .order("booked_at", { ascending: false });
    if (error) { res.json([]); return; }
    res.json(data ?? []);
  } catch {
    res.json([]);
  }
});

// ── GET /api/tickets/admin/all ─────────────────────────────────────────────────
// All tickets with full passenger details — admin only (auth applied in index.ts)
router.get("/admin/all", async (req, res) => {
  const { q, status, line } = req.query as { q?: string; status?: string; line?: string };
  let query = supabase.from("tickets").select(TICKET_SELECT).order("booked_at", { ascending: false }).limit(200);
  if (status) query = query.eq("payment_status", status);
  if (line)   query = query.eq("line", line);
  const { data, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }
  let results = data ?? [];
  // Client-side filter for free-text search across all searchable fields
  if (q) {
    const lower = q.toLowerCase();
    results = results.filter((t: any) =>
      [t.ticket_ref, t.passenger_name, t.id_number, t.email, t.phone,
       t.payment_intent_id, t.train_no].some((v) => v && String(v).toLowerCase().includes(lower))
    );
  }
  res.json(results);
});

// ── POST /api/tickets/admin/reissue ───────────────────────────────────────────
// Resend a ticket to passenger via email and/or SMS
router.post("/admin/reissue", async (req, res) => {
  const { ticketId, channels } = req.body as { ticketId: string; channels: ("email" | "sms")[] };
  if (!ticketId || !channels?.length) {
    res.status(400).json({ error: "ticketId and channels required" });
    return;
  }

  const { data: ticket, error: fetchErr } = await supabase
    .from("tickets")
    .select(TICKET_SELECT)
    .eq("id", ticketId)
    .single();

  if (fetchErr || !ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const results: { channel: string; status: string; error?: string }[] = [];

  if (channels.includes("email") && ticket.email) {
    try {
      await sendEmail({
        to: ticket.email,
        subject: `Your PRASA Ticket — ${ticket.ticket_ref}`,
        html: "",
        templateId: process.env.EMAILJS_TEMPLATE_ID,
        templateParams: {
          to_email: ticket.email,
          ticket_ref: ticket.ticket_ref,
          passenger_name: ticket.passenger_name ?? "Passenger",
          train_no: ticket.train_no,
          line: ticket.line,
          from_station: ticket.from_station,
          to_station: ticket.to_station,
          departure: ticket.departure,
          arrival: ticket.arrival ?? "—",
          fare: `R${Number(ticket.fare).toFixed(2)}`,
          travel_class: ticket.travel_class,
          payment_status: ticket.payment_status.toUpperCase(),
          booked_at: new Date(ticket.booked_at).toLocaleString("en-ZA"),
        },
      });
      results.push({ channel: "email", status: "sent" });
    } catch (err: any) {
      results.push({ channel: "email", status: "failed", error: err.message });
    }
  } else if (channels.includes("email")) {
    results.push({ channel: "email", status: "skipped", error: "No email on record" });
  }

  if (channels.includes("sms") && ticket.phone) {
    try {
      await sendSms(ticket.phone, ticketSmsText(ticket));
      results.push({ channel: "sms", status: "sent" });
    } catch (err: any) {
      results.push({ channel: "sms", status: "failed", error: err.message });
    }
  } else if (channels.includes("sms")) {
    results.push({ channel: "sms", status: "skipped", error: "No phone on record" });
  }

  // Audit log
  const action = channels.map((c) => `reissue_${c}`).join("+");
  try {
    await supabase.from("ticket_recovery_log").insert({
      ticket_id: ticket.id,
      ticket_ref: ticket.ticket_ref,
      action,
      note: results.map((r) => `${r.channel}:${r.status}`).join(" | "),
    });
  } catch { /* audit log failure is non-fatal */ }

  res.json({ ticket_ref: ticket.ticket_ref, results });
});

// ── GET /api/tickets/admin/recovery-log ──────────────────────────────────────
router.get("/admin/recovery-log", async (_req, res) => {
  const { data, error } = await supabase
    .from("ticket_recovery_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data ?? []);
});

export default router;

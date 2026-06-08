import { Router } from "express";
import { randomUUID, randomBytes } from "crypto";
import Stripe from "stripe";
import { supabase } from "../db";

const router = Router();

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeTicketRef(): string {
  // e.g. TKT-2B4F8A1C — timestamp base36 + 4 random hex chars for uniqueness
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = randomBytes(2).toString("hex").toUpperCase();
  return `TKT-${ts}-${rnd}`;
}

function makeQrToken(): string {
  // 32 random bytes → 64 hex chars — used as one-time scan token
  return randomBytes(32).toString("hex");
}

// ── POST /api/tickets/create-payment-intent ───────────────────────────────────
// Creates a Stripe PaymentIntent and a pending ticket record.
// Returns { clientSecret, ticketId } to the frontend.
router.post("/create-payment-intent", async (req, res) => {
  if (!stripe) {
    res.status(503).json({ error: "Stripe is not configured (STRIPE_SECRET_KEY missing)" });
    return;
  }

  const { userId, trainNo, line, from, to, departure, arrival, fare, travelClass } = req.body as {
    userId?: string;
    trainNo: string;
    line: string;
    from: string;
    to: string;
    departure: string;
    arrival: string;
    fare: number;
    travelClass?: string;
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
  const { userId, trainNo, line, from, to, departure, arrival, fare, travelClass } = req.body as {
    userId?: string;
    trainNo: string;
    line: string;
    from: string;
    to: string;
    departure: string;
    arrival: string;
    fare?: number;
    travelClass?: string;
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
  }).select("id, ticket_ref, qr_token, train_no, line, from_station, to_station, departure, arrival, fare, travel_class, booked_at").single();

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

// ── GET /api/tickets/:userId ──────────────────────────────────────────────────
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const { data, error } = await supabase
      .from("tickets")
      .select("id, ticket_ref, qr_token, train_no, line, from_station, to_station, departure, arrival, fare, travel_class, payment_status, used, used_at, booked_at")
      .eq("user_id", userId)
      .eq("payment_status", "paid") // only return paid tickets
      .order("booked_at", { ascending: false });
    if (error) { res.json([]); return; }
    res.json(data ?? []);
  } catch {
    res.json([]);
  }
});

export default router;

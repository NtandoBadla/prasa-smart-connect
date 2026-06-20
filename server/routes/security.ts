import { Router } from "express";
import { createHmac, timingSafeEqual, randomUUID } from "crypto";
import { supabase } from "../db";

const router = Router();

const SECURITY_USER = process.env.SECURITY_USER ?? "security";
const SECURITY_PASS = process.env.SECURITY_PASS ?? "security2025";
const JWT_SECRET    = process.env.ADMIN_JWT_SECRET ?? "prasa-secret-change-me";

function signToken(payload: string): string {
  const sig = createHmac("sha256", JWT_SECRET).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifySecurityToken(token: string): boolean {
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return false;
  const payload  = token.slice(0, lastDot);
  const sig      = token.slice(lastDot + 1);
  const expected = createHmac("sha256", JWT_SECRET).update(payload).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch { return false; }
}

export function requireSecurity(req: any, res: any, next: any) {
  const token = req.headers["x-security-token"] as string | undefined;
  if (!token || !verifySecurityToken(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// ── POST /api/security/login ──────────────────────────────────────────────────
router.post("/login", (req, res) => {
  const { username, password } = req.body as { username: string; password: string };
  if (!username || !password) {
    res.status(400).json({ error: "Username and password required" });
    return;
  }
  if (username === SECURITY_USER && password === SECURITY_PASS) {
    res.json({ token: signToken(`sec.${randomUUID()}.${Date.now()}`) });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

// ── POST /api/security/scan ───────────────────────────────────────────────────
router.post("/scan", requireSecurity, async (req, res) => {
  const { qrToken, stationName, officerId } = req.body as {
    qrToken: string;
    stationName?: string;
    officerId?: string;
  };

  if (!qrToken) {
    res.status(400).json({ error: "qrToken required" });
    return;
  }

  const TICKET_SELECT =
    "id,ticket_ref,qr_token,passenger_name,train_no,line,from_station,to_station,departure,arrival,fare,travel_class,payment_status,used,used_at,booked_at,blacklisted,blacklist_reason,rides_remaining,expires_at";

  const { data: ticket, error: fetchErr } = await supabase
    .from("tickets")
    .select(TICKET_SELECT)
    .eq("qr_token", qrToken)
    .single();

  let validationResult: string;

  if (fetchErr || !ticket) {
    validationResult = "not_found";
    await logScan({ qrToken, officerId, stationName, result: validationResult });
    res.status(404).json({ valid: false, reason: "not_found", message: "Ticket not found." });
    return;
  }

  // Blacklist check
  if ((ticket as any).blacklisted) {
    validationResult = "blacklisted";
    await logScan({ ticketId: ticket.id, officerId, stationName, result: validationResult });
    res.json({
      valid: false,
      reason: "blacklisted",
      message: "This ticket has been blacklisted.",
      blacklist_reason: (ticket as any).blacklist_reason ?? "Fraudulent Activity",
      ticket,
    });
    return;
  }

  // Payment check
  if (ticket.payment_status !== "paid") {
    validationResult = "unpaid";
    await logScan({ ticketId: ticket.id, officerId, stationName, result: validationResult });
    res.json({ valid: false, reason: "unpaid", message: "Ticket has not been paid for.", ticket });
    return;
  }

  // Expiry check
  if ((ticket as any).expires_at && new Date((ticket as any).expires_at) < new Date()) {
    validationResult = "expired";
    await logScan({ ticketId: ticket.id, officerId, stationName, result: validationResult });
    res.json({ valid: false, reason: "expired", message: "Ticket has expired.", ticket });
    return;
  }

  // Rides remaining check (multi-ride tickets)
  const ridesRemaining: number | null = (ticket as any).rides_remaining;
  if (ridesRemaining !== null && ridesRemaining !== undefined && ridesRemaining <= 0) {
    validationResult = "no_rides";
    await logScan({ ticketId: ticket.id, officerId, stationName, result: validationResult });
    res.json({ valid: false, reason: "no_rides", message: "No rides remaining.", ticket });
    return;
  }

  // Single-trip: already used
  if (ridesRemaining === null || ridesRemaining === undefined) {
    if (ticket.used) {
      validationResult = "used";
      await logScan({ ticketId: ticket.id, officerId, stationName, result: validationResult });
      res.json({ valid: false, reason: "used", message: "Ticket already used.", used_at: ticket.used_at, ticket });
      return;
    }
    // Mark single-trip as used
    await supabase
      .from("tickets")
      .update({ used: true, used_at: new Date().toISOString() })
      .eq("id", ticket.id)
      .eq("used", false);
  } else {
    // Deduct one ride
    await supabase
      .from("tickets")
      .update({
        rides_remaining: ridesRemaining - 1,
        ...(ridesRemaining - 1 === 0 ? { used: true, used_at: new Date().toISOString() } : {}),
      })
      .eq("id", ticket.id);
  }

  validationResult = "valid";
  await logScan({ ticketId: ticket.id, officerId, stationName, result: validationResult });

  res.json({
    valid: true,
    reason: "valid",
    message: "Ticket is valid.",
    rides_remaining: ridesRemaining !== null && ridesRemaining !== undefined ? ridesRemaining - 1 : null,
    ticket,
  });
});

async function logScan(params: {
  ticketId?: string;
  qrToken?: string;
  officerId?: string;
  stationName?: string;
  result: string;
}) {
  try {
    await supabase.from("ticket_scans").insert({
      id: randomUUID(),
      ticket_id: params.ticketId ?? null,
      security_officer_id: params.officerId ?? null,
      station_name: params.stationName ?? null,
      scan_time: new Date().toISOString(),
      validation_result: params.result,
    });
  } catch { /* non-fatal */ }
}

// ── GET /api/security/dashboard ───────────────────────────────────────────────
router.get("/dashboard", requireSecurity, async (_req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("ticket_scans")
    .select("validation_result, scan_time")
    .gte("scan_time", today.toISOString());

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const rows = data ?? [];
  const stats = {
    total:       rows.length,
    valid:       rows.filter((r) => r.validation_result === "valid").length,
    expired:     rows.filter((r) => r.validation_result === "expired").length,
    blacklisted: rows.filter((r) => r.validation_result === "blacklisted").length,
    used:        rows.filter((r) => r.validation_result === "used").length,
    no_rides:    rows.filter((r) => r.validation_result === "no_rides").length,
    not_found:   rows.filter((r) => r.validation_result === "not_found").length,
  };

  res.json(stats);
});

// ── GET /api/security/scan-history ───────────────────────────────────────────
router.get("/scan-history", requireSecurity, async (_req, res) => {
  const { data, error } = await supabase
    .from("ticket_scans")
    .select("*")
    .order("scan_time", { ascending: false })
    .limit(100);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data ?? []);
});

export default router;

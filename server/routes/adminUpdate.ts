import { Router } from "express";
import { supabase } from "../db";
import { TrainUpdateSchema } from "../validate";
import { notifySubscribers, sendSms } from "../mailer";

const router = Router();

const isSupabaseConfigured = () =>
  !!process.env.SUPABASE_URL &&
  !process.env.SUPABASE_URL.includes("REPLACE") &&
  !!process.env.SUPABASE_SERVICE_KEY &&
  !process.env.SUPABASE_SERVICE_KEY.includes("REPLACE");

// POST /api/admin/update
router.post("/", async (req, res) => {
  const parsed = TrainUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    console.error("[adminUpdate] Validation failed:", JSON.stringify(parsed.error.flatten().fieldErrors));
    console.error("[adminUpdate] Received body:", JSON.stringify(req.body));
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { trainNo, line, station, status, delayMin, reason } = parsed.data;
  const updatedAt = new Date().toISOString();
  let notified = 0;
  let failed = 0;

  if (!isSupabaseConfigured()) {
    console.warn("Supabase not configured — update not persisted.");
    res.json({ message: "Update processed (Supabase not configured).", notified, failed });
    return;
  }

  // Save the update record
  const { error: dbErr } = await supabase.from("train_updates").insert({
    train_no: trainNo,
    line,
    station,
    status,
    delay_min: delayMin ?? 0,
    reason: reason ?? null,
    updated_at: updatedAt,
  });

  if (dbErr) {
    console.error("DB insert error:", dbErr.message);
    res.status(500).json({ error: "Failed to save update to database." });
    return;
  }

  // Query users from BOTH sources:
  // 1. users whose home station matches
  // 2. users who subscribed to this station via the subscriptions table
  const [usersRes, subsRes] = await Promise.all([
    supabase.from("users").select("email, phone").eq("station", station),
    supabase
      .from("subscriptions")
      .select("station, user_id, users!inner(email, phone)")
      .eq("station", station),
  ]);

  if (usersRes.error) console.error("Users fetch error:", usersRes.error.message);
  if (subsRes.error) console.error("Subscriptions fetch error:", subsRes.error.message);

  // Deduplicate by email
  const emailMap = new Map<string, { email: string; phone?: string }>();
  for (const u of usersRes.data ?? []) {
    if (u.email) emailMap.set(u.email.toLowerCase(), { email: u.email, phone: u.phone ?? undefined });
  }
  for (const sub of subsRes.data ?? []) {
    const user = (sub as any).users as { email: string; phone?: string } | null;
    if (user?.email && !emailMap.has(user.email.toLowerCase())) {
      emailMap.set(user.email.toLowerCase(), { email: user.email, phone: user.phone ?? undefined });
    }
  }
  const subscribers = Array.from(emailMap.values()).filter((u) => !!u.email) as { email: string; phone?: string }[];

  console.log(`[adminUpdate] station="${station}" matched_users=${subscribers.length}`);

  if (subscribers.length > 0) {
    const result = await notifySubscribers(subscribers, {
      trainNo,
      line,
      station,
      status,
      delayMin: delayMin ?? 0,
      reason,
      updatedAt: new Date(updatedAt).toLocaleString("en-ZA", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    });
    notified = result.sent;
    failed = result.failed;

    // SMS notifications for users who provided a phone number
    const smsText = `PRASA Alert: Train ${trainNo} (${line}) at ${station} is ${status}${
      status === "Delayed" ? ` by ${delayMin ?? 0} min` : ""
    }${reason ? `. Reason: ${reason}` : ""}.`;

    const smsResults = await Promise.allSettled(
      subscribers
        .filter((u) => !!u.phone)
        .map((u) => sendSms(u.phone!, smsText)),
    );
    console.log(`[adminUpdate] SMS results:`, smsResults.map((r) => r.status));
  } else {
    console.log(`[adminUpdate] No users registered under station="${station}"`);
  }

  res.json({
    message: "Train update saved and notifications dispatched.",
    notified,
    failed,
  });
});

// GET /api/admin/update
router.get("/", async (_req, res) => {
  if (!isSupabaseConfigured()) {
    res.json([]);
    return;
  }

  const { data, error } = await supabase
    .from("train_updates")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    res.status(500).json({ error: "Failed to fetch updates" });
    return;
  }

  res.json(data ?? []);
});

export default router;

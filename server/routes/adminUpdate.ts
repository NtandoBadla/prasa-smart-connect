import { Router } from "express";
import { supabase } from "../db";
import { TrainUpdateSchema } from "../validate";
import { notifySubscribers } from "../mailer";

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

  // Query users whose registered station exactly matches the selected station
  const { data: users, error: usersErr } = await supabase
    .from("users")
    .select("email")
    .eq("station", station);

  if (usersErr) {
    console.error("Users fetch error:", usersErr.message);
  }

  const subscribers = (users ?? []).filter((u: any) => !!u.email) as { email: string }[];

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

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

  if (isSupabaseConfigured()) {
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

    const { data: subs, error: subErr } = await supabase
      .from("subscriptions")
      .select("users(email)")
      .eq("station", station);

    if (!subErr && subs) {
      const subscribers = (subs as any[])
        .map((s) => s.users)
        .filter(Boolean)
        .flat() as { email: string }[];

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
    }
  } else {
    console.warn("Supabase not configured — update not persisted.");
  }

  res.json({
    message: isSupabaseConfigured()
      ? "Train update saved and notifications dispatched."
      : "Update processed (Supabase not configured).",
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

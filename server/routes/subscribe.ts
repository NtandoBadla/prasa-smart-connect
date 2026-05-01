import { Router } from "express";
import { supabase } from "../db";
import { SubscribeSchema } from "../validate";

const router = Router();

const isSupabaseConfigured =
  !!process.env.SUPABASE_URL &&
  !process.env.SUPABASE_URL.includes("REPLACE") &&
  !!process.env.SUPABASE_SERVICE_KEY &&
  !process.env.SUPABASE_SERVICE_KEY.includes("REPLACE");

// POST /api/subscribe
router.post("/", async (req, res) => {
  const parsed = SubscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  if (!isSupabaseConfigured) {
    res.status(503).json({
      error: "Database not connected. Add your SUPABASE_URL and SUPABASE_SERVICE_KEY to .env and restart the server.",
    });
    return;
  }

  const { email, station } = parsed.data;

  const { data: user, error: userErr } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .single();

  if (userErr || !user) {
    res.status(404).json({ error: "User not found. Please register first." });
    return;
  }

  const { error } = await supabase
    .from("subscriptions")
    .upsert({ user_id: user.id, station }, { onConflict: "user_id,station" });

  if (error) {
    console.error("Subscribe error:", error.message);
    res.status(500).json({ error: "Subscription failed." });
    return;
  }

  res.json({ message: `Subscribed to updates for ${station}` });
});

// GET /api/subscribe/:email
router.get("/:email", async (req, res) => {
  if (!isSupabaseConfigured) {
    res.json([]);
    return;
  }

  const email = decodeURIComponent(req.params.email);

  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .single();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .select("station, created_at")
    .eq("user_id", user.id);

  if (error) {
    res.status(500).json({ error: "Failed to fetch subscriptions" });
    return;
  }

  res.json(data ?? []);
});

export default router;

import { Router } from "express";
import { supabase } from "../db";
import { RegisterSchema } from "../validate";

const router = Router();

const isSupabaseConfigured = () =>
  !!process.env.SUPABASE_URL &&
  !process.env.SUPABASE_URL.includes("REPLACE") &&
  !!process.env.SUPABASE_SERVICE_KEY &&
  !process.env.SUPABASE_SERVICE_KEY.includes("REPLACE");

router.post("/", async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { email, station } = parsed.data;

  if (!isSupabaseConfigured()) {
    res.status(503).json({
      error: "Database not connected. Add your SUPABASE_URL and SUPABASE_SERVICE_KEY to .env and restart the server.",
    });
    return;
  }

  const { data, error } = await supabase
    .from("users")
    .upsert({ email, station }, { onConflict: "email" })
    .select()
    .single();

  if (error) {
    console.error("Register error:", error.message);
    res.status(500).json({ error: "Registration failed. Please try again." });
    return;
  }

  // Auto-subscribe to home station
  await supabase
    .from("subscriptions")
    .upsert({ user_id: data.id, station }, { onConflict: "user_id,station" });

  res.status(201).json({ message: "Registered successfully", userId: data.id });
});

export default router;

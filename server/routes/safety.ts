import { Router } from "express";
import { supabase } from "../db";

const router = Router();

const VALID_TYPES = [
  "Suspicious activity",
  "Theft / robbery",
  "Damage / vandalism",
  "Medical assistance",
  "Other",
] as const;

const isConfigured = () =>
  !!process.env.SUPABASE_URL &&
  !process.env.SUPABASE_URL.includes("REPLACE") &&
  !!process.env.SUPABASE_SERVICE_KEY &&
  !process.env.SUPABASE_SERVICE_KEY.includes("REPLACE");

// GET /api/safety
router.get("/", async (_req, res) => {
  if (!isConfigured()) { res.json([]); return; }
  const { data, error } = await supabase
    .from("safety_incidents")
    .select("id, type, station, details, status, created_at")
    .order("created_at", { ascending: false });
  if (error) { res.status(500).json({ error: "Failed to fetch incidents" }); return; }
  res.json(data ?? []);
});

// POST /api/safety
router.post("/", async (req, res) => {
  const { type, station, details } = req.body as {
    type: string;
    station: string;
    details: string;
  };

  if (!type?.trim() || !station?.trim() || !details?.trim()) {
    res.status(400).json({ error: "type, station and details are required" });
    return;
  }

  if (!VALID_TYPES.includes(type as any)) {
    res.status(400).json({ error: "Invalid incident type" });
    return;
  }

  if (!isConfigured()) {
    res.status(503).json({ error: "Database not connected. Add SUPABASE_URL and SUPABASE_SERVICE_KEY to .env" });
    return;
  }

  const { data, error } = await supabase
    .from("safety_incidents")
    .insert({
      type,
      station: station.trim(),
      details: details.trim().slice(0, 500),
      status: "pending",
    })
    .select("id, type, station, details, status, created_at")
    .single();

  if (error) {
    console.error("Safety incident insert error:", error.message);
    res.status(500).json({ error: "Failed to submit incident report" });
    return;
  }

  res.status(201).json(data);
});

// PATCH /api/safety/:id/status
router.patch("/:id/status", async (req, res) => {
  const { status } = req.body as { status: string };
  if (!isConfigured()) { res.status(503).json({ error: "DB not configured" }); return; }
  const { data, error } = await supabase
    .from("safety_incidents")
    .update({ status })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) { res.status(500).json({ error: "Update failed" }); return; }
  res.json(data);
});

export default router;

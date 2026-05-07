import { Router } from "express";
import { supabase } from "../db";

const router = Router();

const isConfigured = () =>
  !!process.env.SUPABASE_URL &&
  !process.env.SUPABASE_URL.includes("REPLACE") &&
  !!process.env.SUPABASE_SERVICE_KEY &&
  !process.env.SUPABASE_SERVICE_KEY.includes("REPLACE");

// GET /api/lost-found
router.get("/", async (_req, res) => {
  if (!isConfigured()) { res.json([]); return; }
  const { data, error } = await supabase
    .from("lost_found")
    .select("id, item, station, date, contact_ref, status, created_at")
    .order("created_at", { ascending: false });
  if (error) { res.status(500).json({ error: "Failed to fetch reports" }); return; }
  res.json(data ?? []);
});

// POST /api/lost-found
router.post("/", async (req, res) => {
  const { item, station, date, contact } = req.body as {
    item: string;
    station: string;
    date: string;
    contact: string;
  };

  if (!item?.trim() || !station?.trim() || !contact?.trim()) {
    res.status(400).json({ error: "item, station and contact are required" });
    return;
  }

  if (!isConfigured()) {
    res.status(503).json({ error: "Database not connected. Add SUPABASE_URL and SUPABASE_SERVICE_KEY to .env" });
    return;
  }

  // Generate a public reference — never expose the real contact
  const contact_ref = `ref-${Date.now().toString(36).toUpperCase()}`;

  const { data, error } = await supabase
    .from("lost_found")
    .insert({
      item: item.trim().slice(0, 120),
      station: station.trim(),
      date: date || new Date().toISOString().slice(0, 10),
      contact: contact.trim().slice(0, 120),
      contact_ref,
      status: "open",
    })
    .select("id, item, station, date, contact_ref, status, created_at")
    .single();

  if (error) {
    console.error("Lost & found insert error:", error.message);
    res.status(500).json({ error: "Failed to submit report" });
    return;
  }

  res.status(201).json(data);
});

// PATCH /api/lost-found/:id/status
router.patch("/:id/status", async (req, res) => {
  const { status } = req.body as { status: "open" | "matched" };
  if (!["open", "matched"].includes(status)) {
    res.status(400).json({ error: "status must be open or matched" });
    return;
  }
  const { data, error } = await supabase
    .from("lost_found")
    .update({ status })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) { res.status(500).json({ error: "Update failed" }); return; }
  res.json(data);
});

export default router;

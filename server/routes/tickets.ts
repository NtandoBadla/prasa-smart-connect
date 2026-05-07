import { Router } from "express";
import { randomUUID } from "crypto";
import { supabase } from "../db";

const router = Router();

// POST /api/tickets — generate a ticket
router.post("/", async (req, res) => {
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

  if (!trainNo || !from || !to || !departure) {
    res.status(400).json({ error: "trainNo, from, to, departure required" });
    return;
  }

  const ticket = {
    id: randomUUID(),
    ticket_ref: `TKT-${Date.now().toString(36).toUpperCase()}`,
    user_id: userId ?? null,
    train_no: trainNo,
    line,
    from_station: from,
    to_station: to,
    departure,
    arrival,
    fare: fare ?? 0,
    travel_class: travelClass ?? "Metro",
    booked_at: new Date().toISOString(),
  };

  try {
    const { error } = await supabase.from("tickets").insert(ticket);
    if (error) {
      // If table doesn't exist yet, return ticket without persisting
      console.warn("Supabase tickets insert:", error.message);
    }
  } catch {
    // Supabase not configured — return ticket anyway
  }

  res.status(201).json(ticket);
});

// GET /api/tickets/timetable — full timetable for admin storage
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

// POST /api/tickets/timetable — admin adds a timetable entry
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

// GET /api/tickets/:userId — fetch ticket history for a user
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .eq("user_id", userId)
      .order("booked_at", { ascending: false });
    if (error) { res.json([]); return; }
    res.json(data ?? []);
  } catch {
    res.json([]);
  }
});

export default router;

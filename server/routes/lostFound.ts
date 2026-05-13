import { Router } from "express";
import { supabase } from "../db";
import { sendEmail } from "../mailer";

const router = Router();

const isConfigured = () =>
  !!process.env.SUPABASE_URL &&
  !process.env.SUPABASE_URL.includes("REPLACE") &&
  !!process.env.SUPABASE_SERVICE_KEY &&
  !process.env.SUPABASE_SERVICE_KEY.includes("REPLACE");

// GET /api/lost-found - Public endpoint (shows only open items without contact info)
router.get("/", async (_req, res) => {
  if (!isConfigured()) { res.json([]); return; }
  const { data, error } = await supabase
    .from("lost_found")
    .select("id, item, station, date, contact_ref, status, created_at")
    .order("created_at", { ascending: false });
  if (error) { res.status(500).json({ error: "Failed to fetch reports" }); return; }
  res.json(data ?? []);
});

// POST /api/lost-found - Report a lost item
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

  // Generate a unique reference ID
  const contact_ref = `LF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

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

  // Send confirmation email to user
  try {
    await sendEmail({
      to: contact.trim(),
      subject: "Lost Item Report Confirmation - PRASA",
      html: "", // Not used when templateId is provided
      templateId: "template_lost_confirm",
      templateParams: {
        to_email: contact.trim(),
        contact_ref: contact_ref,
        item: item.trim(),
        station: station.trim(),
        date: new Date(date).toLocaleDateString('en-ZA'),
        submitted_date: new Date().toLocaleDateString('en-ZA')
      }
    });
  } catch (emailError) {
    console.error("Failed to send confirmation email:", emailError);
    // Don't fail the request if email fails
  }

  res.status(201).json(data);
});

export default router;

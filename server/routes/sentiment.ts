import { Router } from "express";
import axios from "axios";

const router = Router();

// VADER-style lexicon for train/transit context
const POSITIVE_WORDS = ["clean", "safe", "punctual", "comfortable", "reliable", "good", "great", "excellent", "smooth", "fast", "friendly", "helpful", "quiet", "spacious", "on time", "efficient"];
const NEGATIVE_WORDS = ["crowded", "dirty", "unsafe", "late", "delayed", "cancelled", "broken", "dangerous", "smelly", "packed", "terrible", "awful", "slow", "crime", "theft", "vandal", "overcrowded", "risky", "scary", "violent"];
const CROWD_WORDS = ["crowded", "packed", "full", "standing", "squashed", "overcrowded", "busy", "rush", "peak", "sardines"];
const SAFE_WORDS = ["safe", "security", "guard", "police", "camera", "cctv", "patrol"];
const UNSAFE_WORDS = ["crime", "theft", "robbery", "assault", "unsafe", "dangerous", "risky", "violent", "scary", "mugging"];

function vaderScore(text: string): { compound: number; crowd: number; safety: number } {
  const lower = text.toLowerCase();
  const words = lower.split(/\W+/);

  let pos = 0, neg = 0, crowd = 0, safePos = 0, safeNeg = 0;

  for (const w of words) {
    if (POSITIVE_WORDS.some((p) => w.includes(p))) pos++;
    if (NEGATIVE_WORDS.some((n) => w.includes(n))) neg++;
    if (CROWD_WORDS.some((c) => w.includes(c))) crowd++;
    if (SAFE_WORDS.some((s) => w.includes(s))) safePos++;
    if (UNSAFE_WORDS.some((s) => w.includes(s))) safeNeg++;
  }

  // Also check multi-word phrases
  if (lower.includes("on time")) pos++;
  if (lower.includes("not safe") || lower.includes("not clean")) neg++;

  const total = pos + neg || 1;
  const compound = (pos - neg) / total; // -1 to 1
  const crowdScore = Math.min(1, crowd / 3); // 0 to 1
  const safetyScore = (safePos - safeNeg) / (safePos + safeNeg || 1);

  return { compound, crowd: crowdScore, safety: safetyScore };
}

async function huggingFaceAnalyze(text: string): Promise<{ label: string; score: number } | null> {
  const hfKey = process.env.HUGGINGFACE_API_KEY;
  if (!hfKey || hfKey.includes("REPLACE")) return null;

  try {
    const res = await axios.post(
      "https://api-inference.huggingface.co/models/distilbert-base-uncased-finetuned-sst-2-english",
      { inputs: text.slice(0, 512) },
      { headers: { Authorization: `Bearer ${hfKey}` }, timeout: 8000 }
    );
    const results = res.data?.[0];
    if (Array.isArray(results)) {
      return results.sort((a: any, b: any) => b.score - a.score)[0];
    }
    return null;
  } catch {
    return null;
  }
}

// POST /api/sentiment
router.post("/", async (req, res) => {
  const { texts } = req.body as { texts: string[] };
  if (!texts || !Array.isArray(texts) || texts.length === 0) {
    res.status(400).json({ error: "texts array required" });
    return;
  }

  const combined = texts.join(" ");
  const vader = vaderScore(combined);

  // Try HuggingFace for richer sentiment
  const hf = await huggingFaceAnalyze(combined);

  // Determine crowd level
  let crowdLevel: "Low" | "Medium" | "High";
  if (vader.crowd > 0.6) crowdLevel = "High";
  else if (vader.crowd > 0.3) crowdLevel = "Medium";
  else crowdLevel = "Low";

  // Determine safety rating
  let safetyRating: "Safe" | "Moderate" | "Risky";
  const effectiveSafety = hf
    ? hf.label === "POSITIVE" ? vader.safety + 0.3 : vader.safety - 0.3
    : vader.safety;

  if (effectiveSafety > 0.2) safetyRating = "Safe";
  else if (effectiveSafety > -0.2) safetyRating = "Moderate";
  else safetyRating = "Risky";

  // Overall sentiment score (0-100)
  const sentimentScore = Math.round(((vader.compound + 1) / 2) * 100);

  res.json({
    crowdLevel,
    safetyRating,
    sentimentScore,
    compound: vader.compound,
    crowdScore: vader.crowd,
    safetyScore: vader.safety,
    huggingFace: hf ?? null,
    analyzedCount: texts.length,
  });
});

export default router;

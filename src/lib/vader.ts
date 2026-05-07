// VADER sentiment wrapper (browser).
// vader-sentiment exposes SentimentIntensityAnalyzer with polarity_scores.
// Returns { neg, neu, pos, compound }.
// We map compound to a label using standard thresholds.

// @ts-ignore - no types shipped
import vader from "vader-sentiment";

export type SentimentLabel = "positive" | "neutral" | "negative";

export interface VaderResult {
  label: SentimentLabel;
  compound: number;
  scores: { positive: number; neutral: number; negative: number };
}

export function analyzeWithVader(text: string): VaderResult {
  const s = vader.SentimentIntensityAnalyzer.polarity_scores(text);
  const compound = s.compound as number;
  let label: SentimentLabel = "neutral";
  if (compound >= 0.05) label = "positive";
  else if (compound <= -0.05) label = "negative";
  return {
    label,
    compound,
    scores: { positive: s.pos, neutral: s.neu, negative: s.neg },
  };
}

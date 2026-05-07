import type { SentimentLabel } from "@/lib/vader";

export interface AnalysisRecord {
  id: string;
  text: string;
  createdAt: number;
  hf: {
    label: SentimentLabel;
    confidence: number;
    distribution: { positive: number; neutral: number; negative: number };
  };
  vader: {
    label: SentimentLabel;
    compound: number;
    scores: { positive: number; neutral: number; negative: number };
  };
}

export interface BusinessInfo {
  name: string;
  industry: string;
  contactEmail: string;
}

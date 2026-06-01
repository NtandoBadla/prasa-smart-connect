import { z } from "zod";

export const RegisterSchema = z.object({
  email: z.string().email("Invalid email address"),
  station: z.string().min(2, "Station name too short").max(100),
  phone: z
    .string()
    .transform((v) => v.replace(/\s+/g, ""))
    .refine((v) => /^(\+27|0)[0-9]{9}$/.test(v), "Phone must be +27XXXXXXXXX or 0XXXXXXXXX")
    .transform((v) => (v.startsWith("0") ? "+27" + v.slice(1) : v))
    .optional(),
});

export const SubscribeSchema = z.object({
  email: z.string().email("Invalid email address"),
  station: z.string().min(2).max(100),
});

export const TrainUpdateSchema = z.object({
  trainNo: z.string().default("N/A"),
  line: z.enum(["Southern Line", "Northern Line", "Central Line", "Cape Flats Line"]),
  station: z.string().min(2).max(100),
  status: z.enum(["On Time", "Delayed", "Cancelled"]),
  delayMin: z.number().int().min(0).optional().default(0),
  reason: z.string().max(500).optional(),
});

export const ChatbotSchema = z.object({
  message: z.string().min(1).max(1000),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type SubscribeInput = z.infer<typeof SubscribeSchema>;
export type TrainUpdateInput = z.infer<typeof TrainUpdateSchema>;
export type ChatbotInput = z.infer<typeof ChatbotSchema>;

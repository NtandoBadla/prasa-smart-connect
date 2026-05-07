import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? "https://placeholder.supabase.co";
const key = process.env.SUPABASE_SERVICE_KEY ?? "placeholder";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.warn("⚠️  SUPABASE_URL / SUPABASE_SERVICE_KEY not set — DB features disabled");
}

export const supabase = createClient(url, key);


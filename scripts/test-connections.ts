import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";

const OK   = "\x1b[32m✔\x1b[0m";
const FAIL = "\x1b[31m✘\x1b[0m";
const WARN = "\x1b[33m⚠\x1b[0m";

console.log("\n\x1b[1m━━━ PRASA Smart Connect — Connection Test ━━━\x1b[0m\n");

// ── 1. Supabase ───────────────────────────────────────────────────────────────
async function testSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || url.includes("REPLACE") || !key || key.includes("REPLACE")) {
    console.log(`${FAIL} Supabase     — keys missing in .env`);
    return false;
  }
  try {
    const sb = createClient(url, key);
    const tables = ["users", "subscriptions", "train_updates", "tickets"];
    const results = await Promise.all(
      tables.map((t) => sb.from(t).select("*", { count: "exact", head: true }))
    );
    const missing = tables.filter((_, i) => results[i].error);
    if (missing.length > 0) {
      console.log(`${FAIL} Supabase     — connected but tables missing: ${missing.join(", ")}`);
      console.log(`   ${WARN}  Run the SQL shown at the bottom of this output`);
      return false;
    }
    const counts = tables.map((t, i) => `${t}(${results[i].count ?? 0})`).join(", ");
    console.log(`${OK} Supabase     — connected | ${counts}`);
    return true;
  } catch (e: any) {
    console.log(`${FAIL} Supabase     — ${e.message}`);
    return false;
  }
}

// ── 2. SerpAPI ────────────────────────────────────────────────────────────────
async function testSerpAPI() {
  const key = process.env.SERPAPI_KEY;
  if (!key || key.includes("REPLACE")) {
    console.log(`${FAIL} SerpAPI      — key missing in .env`);
    return false;
  }
  try {
    const res = await axios.get("https://serpapi.com/account", {
      params: { api_key: key },
      timeout: 8000,
      validateStatus: () => true,
    });
    if (res.status === 200) {
      const credits = res.data?.total_searches_left ?? "unknown";
      console.log(`${OK} SerpAPI      — connected | searches left: ${credits}`);
      return true;
    }
    console.log(`${FAIL} SerpAPI      — status ${res.status}: ${res.data?.error ?? "invalid key"}`);
    return false;
  } catch (e: any) {
    console.log(`${FAIL} SerpAPI      — ${e.message}`);
    return false;
  }
}

// ── 3. EmailJS ────────────────────────────────────────────────────────────────
async function testEmailJS() {
  const serviceId  = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey  = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (!serviceId || serviceId.includes("REPLACE") || !templateId || !publicKey || !privateKey) {
    console.log(`${FAIL} EmailJS      — keys missing in .env`);
    return false;
  }
  try {
    const res = await axios.post(
      "https://api.emailjs.com/api/v1.0/email/send",
      {
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        accessToken: privateKey,
        template_params: {
          to_email:   "test@test.com",
          train_no:   "TEST",
          line:       "Test Line",
          station:    "Test Station",
          status:     "On Time",
          reason:     "Connection test",
          updated_at: new Date().toLocaleString("en-ZA"),
        },
      },
      { timeout: 8000, validateStatus: () => true }
    );
    if (res.status === 200) {
      console.log(`${OK} EmailJS      — connected | test email sent`);
      return true;
    }
    if (res.status === 400) {
      console.log(`${WARN} EmailJS      — keys valid but template variable mismatch (status 400)`);
      console.log(`   Ensure template has: {{to_email}} {{train_no}} {{line}} {{station}} {{status}} {{reason}} {{updated_at}}`);
      return true;
    }
    console.log(`${FAIL} EmailJS      — status ${res.status}: ${JSON.stringify(res.data)}`);
    return false;
  } catch (e: any) {
    console.log(`${FAIL} EmailJS      — ${e.message}`);
    return false;
  }
}

// ── 4. OpenAI ─────────────────────────────────────────────────────────────────
async function testOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.includes("REPLACE") || key.trim() === "") {
    console.log(`${WARN} OpenAI       — not set (chatbot uses rule-based fallback)`);
    return false;
  }
  try {
    const res = await axios.get("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      timeout: 8000,
      validateStatus: () => true,
    });
    if (res.status === 200) {
      console.log(`${OK} OpenAI       — connected`);
      return true;
    }
    console.log(`${FAIL} OpenAI       — status ${res.status}: invalid key`);
    return false;
  } catch (e: any) {
    console.log(`${FAIL} OpenAI       — ${e.message}`);
    return false;
  }
}

// ── 5. HuggingFace ────────────────────────────────────────────────────────────
async function testHuggingFace() {
  const key = process.env.HUGGINGFACE_API_KEY;
  if (!key || key.includes("REPLACE") || key.trim() === "") {
    console.log(`${WARN} HuggingFace  — not set (sentiment uses VADER fallback)`);
    return false;
  }
  try {
    const res = await axios.post(
      "https://api-inference.huggingface.co/models/distilbert-base-uncased-finetuned-sst-2-english",
      { inputs: "test" },
      { headers: { Authorization: `Bearer ${key}` }, timeout: 8000, validateStatus: () => true }
    );
    if (res.status === 200 || res.status === 503) {
      console.log(`${OK} HuggingFace  — key valid${res.status === 503 ? " (model loading)" : ""}`);
      return true;
    }
    console.log(`${FAIL} HuggingFace  — status ${res.status}: invalid key`);
    return false;
  } catch (e: any) {
    console.log(`${FAIL} HuggingFace  — ${e.message}`);
    return false;
  }
}

// ── 6. SMSPortal ───────────────────────────────────────────────────────────────────────────────
async function testSMSPortal() {
  const clientId     = process.env.SMSPORTAL_CLIENT_ID;
  const clientSecret = process.env.SMSPORTAL_CLIENT_SECRET;
  if (!clientId || clientId.includes("your-") || !clientSecret || clientSecret.includes("your-")) {
    console.log(`${WARN} SMSPortal    — not set (SMS notifications disabled)`);
    return false;
  }
  try {
    const res = await axios.get("https://rest.smsportal.com/v1/Authentication", {
      auth: { username: clientId, password: clientSecret },
      timeout: 8000,
      validateStatus: () => true,
    });
    if (res.status === 200 && res.data?.token) {
      console.log(`${OK} SMSPortal    — authenticated`);
      return true;
    }
    console.log(`${FAIL} SMSPortal    — status ${res.status}: invalid credentials`);
    return false;
  } catch (e: any) {
    console.log(`${FAIL} SMSPortal    — ${e.message}`);
    return false;
  }
}

// ── 7. Local API server ───────────────────────────────────────────────────────────────────────────────
async function testAPIServer() {
  try {
    const res = await axios.get("http://localhost:3001/api/health", { timeout: 3000 });
    const d = res.data;
    console.log(`${OK} API Server   — running on :3001`);
    console.log(`   supabase:${d.supabase} | emailjs:${d.emailjs} | serpapi:${d.serpapi} | openai:${d.openai}`);
    return true;
  } catch {
    console.log(`${FAIL} API Server   — not running. Open a new terminal and run: npm run server`);
    return false;
  }
}

// ── Run all ───────────────────────────────────────────────────────────────────
const [sb, serp, ejs, oai, hf, sms, api] = await Promise.all([
  testSupabase(),
  testSerpAPI(),
  testEmailJS(),
  testOpenAI(),
  testHuggingFace(),
  testSMSPortal(),
  testAPIServer(),
]);

console.log("\n\x1b[1m━━━ Summary ━━━\x1b[0m");
console.log(` Supabase    ${sb   ? OK + " OK"              : FAIL + " FAIL"}`);
console.log(` SerpAPI     ${serp ? OK + " OK"              : FAIL + " FAIL"}`);
console.log(` EmailJS     ${ejs  ? OK + " OK"              : FAIL + " FAIL"}`);
console.log(` OpenAI      ${oai  ? OK + " OK"              : WARN + " not set (optional)"}`);
console.log(` HuggingFace ${hf   ? OK + " OK"              : WARN + " not set (optional)"}`);
console.log(` SMSPortal   ${sms  ? OK + " OK"              : WARN + " not set (optional)"}`);
console.log(` API Server  ${api  ? OK + " running"         : FAIL + " not running"}`);

if (!sb) {
  console.log(`
\x1b[33mSupabase tables missing? Run this in https://supabase.com → SQL Editor:\x1b[0m

  create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    email text unique not null,
    station text not null,
    created_at timestamptz default now()
  );
  create table if not exists subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references users(id) on delete cascade,
    station text not null,
    created_at timestamptz default now(),
    unique(user_id, station)
  );
  create table if not exists train_updates (
    id uuid primary key default gen_random_uuid(),
    train_no text not null,
    line text not null,
    station text not null,
    status text not null,
    delay_min integer default 0,
    reason text,
    updated_at timestamptz default now()
  );
  create table if not exists tickets (
    id uuid primary key default gen_random_uuid(),
    ticket_ref text not null,
    user_id uuid,
    train_no text not null,
    line text not null,
    from_station text not null,
    to_station text not null,
    departure text not null,
    arrival text,
    fare numeric default 0,
    travel_class text default 'Metro',
    booked_at timestamptz default now()
  );
`);
}

console.log("");

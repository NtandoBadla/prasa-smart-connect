import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? "https://placeholder.supabase.co";
const key = process.env.SUPABASE_SERVICE_KEY ?? "placeholder";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.warn("⚠️  SUPABASE_URL / SUPABASE_SERVICE_KEY not set — DB features disabled");
}

export const supabase = createClient(url, key);

/*
  Required Supabase tables (run in SQL editor):

  create table users (
    id uuid primary key default gen_random_uuid(),
    email text unique not null,
    station text not null,
    created_at timestamptz default now()
  );

  create table subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references users(id) on delete cascade,
    station text not null,
    created_at timestamptz default now(),
    unique(user_id, station)
  );

  create table train_updates (
    id uuid primary key default gen_random_uuid(),
    train_no text not null,
    line text not null,
    station text not null,
    status text not null,
    delay_min integer default 0,
    reason text,
    updated_at timestamptz default now()
  );
*/

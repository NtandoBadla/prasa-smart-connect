-- ── Users ─────────────────────────────────────────────────────────────────────
create table if not exists users (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  station    text not null,
  created_at timestamptz default now()
);

create index if not exists idx_users_email   on users (email);
create index if not exists idx_users_station on users (station);

-- ── Station alert subscriptions ───────────────────────────────────────────────
create table if not exists subscriptions (
  id         bigserial primary key,
  user_id    uuid not null references users(id) on delete cascade,
  station    text not null,
  created_at timestamptz default now(),
  unique(user_id, station)
);

create index if not exists idx_subscriptions_station on subscriptions (station);
create index if not exists idx_subscriptions_user_id on subscriptions (user_id);

-- ── Train status updates posted by admin ──────────────────────────────────────
create table if not exists train_updates (
  id         bigserial primary key,
  train_no   text not null,
  line       text not null,
  station    text not null,
  status     text not null,
  delay_min  integer default 0,
  reason     text,
  updated_at timestamptz default now()
);

create index if not exists idx_train_updates_station    on train_updates (station);
create index if not exists idx_train_updates_updated_at on train_updates (updated_at desc);

-- ── Generated passenger tickets ───────────────────────────────────────────────
create table if not exists tickets (
  id           uuid primary key default gen_random_uuid(),
  ticket_ref   text not null,
  user_id      uuid,
  train_no     text not null,
  line         text not null,
  from_station text not null,
  to_station   text not null,
  departure    text not null,
  arrival      text,
  fare         numeric default 0,
  travel_class text default 'Metro',
  booked_at    timestamptz default now()
);

create index if not exists idx_tickets_user_id  on tickets (user_id);
create index if not exists idx_tickets_booked_at on tickets (booked_at desc);

-- ── Safety incidents ──────────────────────────────────────────────────────────
create table if not exists safety_incidents (
  id         bigserial primary key,
  type       text not null,
  station    text not null,
  details    text,
  status     text default 'pending',
  created_at timestamptz default now()
);

create index if not exists idx_safety_incidents_status     on safety_incidents (status);
create index if not exists idx_safety_incidents_created_at on safety_incidents (created_at desc);

-- ── Scraped live trains ───────────────────────────────────────────────────────
create table if not exists scraped_trains (
  id           bigserial primary key,
  train_no     text,
  from_station text,
  to_station   text,
  departure    text,
  arrival      text,
  status       text,
  line         text,
  delay_min    integer default 0,
  reason       text,
  scraped_at   timestamptz default now()
);

create index if not exists idx_scraped_trains_scraped_at on scraped_trains (scraped_at desc);
create index if not exists idx_scraped_trains_line       on scraped_trains (line);

-- ── Scraped service notices ───────────────────────────────────────────────────
create table if not exists scraped_notices (
  id         bigserial primary key,
  title      text,
  body       text,
  line       text,
  scraped_at timestamptz default now()
);

create index if not exists idx_scraped_notices_scraped_at on scraped_notices (scraped_at desc);

-- ── Lost & Found ──────────────────────────────────────────────────────────────
create table if not exists lost_found (
  id          bigserial primary key,
  item        text not null,
  station     text not null,
  date        date not null,
  contact     text not null,
  contact_ref text not null unique,
  status      text default 'open' check (status in ('open', 'matched')),
  created_at  timestamptz default now()
);

create index if not exists idx_lost_found_created_at  on lost_found (created_at desc);
create index if not exists idx_lost_found_station     on lost_found (station);
create index if not exists idx_lost_found_status      on lost_found (status);
create index if not exists idx_lost_found_contact_ref on lost_found (contact_ref);

-- ── Coach feedback ────────────────────────────────────────────────────────────
create table if not exists coach_feedback (
  id             bigserial primary key,
  train_no       text,
  line           text,
  from_station   text,
  to_station     text,
  coach          integer,
  feedback_text  text,
  hf_label       text,
  hf_confidence  numeric,
  vader_label    text,
  vader_compound numeric,
  travel_time    text,
  submitted_at   timestamptz default now()
);

create index if not exists idx_coach_feedback_submitted_at on coach_feedback (submitted_at desc);
create index if not exists idx_coach_feedback_coach        on coach_feedback (coach);
create index if not exists idx_coach_feedback_line         on coach_feedback (line);

-- ── Station search cache ──────────────────────────────────────────────────────
create table if not exists station_cache (
  query      text primary key,
  results    jsonb not null,
  cached_at  timestamptz default now()
);

create index if not exists idx_station_cache_cached_at on station_cache (cached_at desc);

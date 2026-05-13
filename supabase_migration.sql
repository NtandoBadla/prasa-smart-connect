

create table if not exists scraped_trains (
  id          bigserial primary key,
  train_no    text,
  from_station text,
  to_station  text,
  departure   text,
  arrival     text,
  status      text,
  line        text,
  delay_min   integer default 0,
  reason      text,
  scraped_at  timestamptz default now()
);

create index if not exists idx_scraped_trains_scraped_at on scraped_trains (scraped_at desc);
create index if not exists idx_scraped_trains_line on scraped_trains (line);

create table if not exists scraped_notices (
  id         bigserial primary key,
  title      text,
  body       text,
  line       text,
  scraped_at timestamptz default now()
);

create index if not exists idx_scraped_notices_scraped_at on scraped_notices (scraped_at desc);

-- Lost & Found items
create table if not exists lost_found (
  id          bigserial primary key,
  item        text not null,
  station     text not null,
  date        date not null,
  contact     text not null, -- private email/phone
  contact_ref text not null unique, -- public reference ID
  status      text default 'open' check (status in ('open', 'matched')),
  created_at  timestamptz default now()
);

create index if not exists idx_lost_found_created_at on lost_found (created_at desc);
create index if not exists idx_lost_found_station on lost_found (station);
create index if not exists idx_lost_found_status on lost_found (status);
create index if not exists idx_lost_found_contact_ref on lost_found (contact_ref);

-- Coach feedback from crowding/sentiment page
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
create index if not exists idx_coach_feedback_coach on coach_feedback (coach);
create index if not exists idx_coach_feedback_line on coach_feedback (line);

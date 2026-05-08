

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

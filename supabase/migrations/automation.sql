-- ── Automation Log ────────────────────────────────────────────────────────────
-- Central audit trail for all automated events
create table if not exists automation_logs (
  id          bigserial primary key,
  event_type  text not null,  -- 'ticket_expired' | 'ride_deducted' | 'alert_sent' | 'report_generated' | 'crowding_updated' | 'lost_found_notified'
  entity_type text,           -- 'ticket' | 'train_update' | 'lost_found' | 'coach_feedback'
  entity_id   text,
  payload     jsonb,
  status      text not null default 'ok', -- 'ok' | 'error'
  error_msg   text,
  created_at  timestamptz default now()
);

create index if not exists idx_automation_logs_event_type on automation_logs (event_type);
create index if not exists idx_automation_logs_created_at on automation_logs (created_at desc);
create index if not exists idx_automation_logs_status     on automation_logs (status);

-- ── Crowding Predictions ───────────────────────────────────────────────────────
-- Materialised crowding scores per line/station, recalculated on new feedback
create table if not exists crowding_predictions (
  id               bigserial primary key,
  line             text not null,
  station          text not null,
  avg_vader        numeric,
  avg_hf_confidence numeric,
  dominant_label   text,
  feedback_count   integer default 0,
  crowding_score   numeric,   -- 0-100: higher = more crowded / worse sentiment
  safety_score     numeric,   -- 0-100: higher = safer
  last_calculated  timestamptz default now(),
  unique(line, station)
);

create index if not exists idx_crowding_line_station on crowding_predictions (line, station);

-- ── Daily Reports ─────────────────────────────────────────────────────────────
create table if not exists daily_reports (
  id             bigserial primary key,
  report_date    date not null unique,
  tickets_issued integer default 0,
  tickets_used   integer default 0,
  tickets_expired integer default 0,
  total_delays   integer default 0,
  avg_delay_min  numeric,
  safety_incidents integer default 0,
  lost_found_open   integer default 0,
  lost_found_matched integer default 0,
  crowding_avg   numeric,
  top_delayed_line text,
  report_json    jsonb,
  created_at     timestamptz default now()
);

create index if not exists idx_daily_reports_date on daily_reports (report_date desc);

-- ── Trigger: Recalculate crowding on new coach_feedback ───────────────────────
create or replace function fn_recalculate_crowding()
returns trigger language plpgsql as $$
declare
  v_line    text := NEW.line;
  v_station text := NEW.from_station;
  v_avg_vader    numeric;
  v_avg_hf       numeric;
  v_dom_label    text;
  v_count        integer;
  v_crowd_score  numeric;
  v_safety_score numeric;
begin
  select
    avg(vader_compound),
    avg(hf_confidence),
    mode() within group (order by vader_label),
    count(*)
  into v_avg_vader, v_avg_hf, v_dom_label, v_count
  from coach_feedback
  where line = v_line and from_station = v_station;

  -- crowding_score: negative sentiment → higher crowding (0–100)
  v_crowd_score  := greatest(0, least(100, round((0.5 - coalesce(v_avg_vader, 0)) * 100)));
  -- safety_score: positive sentiment → higher safety (0–100)
  v_safety_score := greatest(0, least(100, round((0.5 + coalesce(v_avg_vader, 0)) * 100)));

  insert into crowding_predictions
    (line, station, avg_vader, avg_hf_confidence, dominant_label, feedback_count, crowding_score, safety_score, last_calculated)
  values
    (v_line, v_station, v_avg_vader, v_avg_hf, v_dom_label, v_count, v_crowd_score, v_safety_score, now())
  on conflict (line, station) do update set
    avg_vader         = excluded.avg_vader,
    avg_hf_confidence = excluded.avg_hf_confidence,
    dominant_label    = excluded.dominant_label,
    feedback_count    = excluded.feedback_count,
    crowding_score    = excluded.crowding_score,
    safety_score      = excluded.safety_score,
    last_calculated   = now();

  -- Audit log
  insert into automation_logs (event_type, entity_type, entity_id, payload)
  values (
    'crowding_updated', 'coach_feedback', NEW.id::text,
    jsonb_build_object('line', v_line, 'station', v_station,
                       'crowding_score', v_crowd_score, 'safety_score', v_safety_score)
  );

  return NEW;
end;
$$;

drop trigger if exists trg_recalculate_crowding on coach_feedback;
create trigger trg_recalculate_crowding
  after insert on coach_feedback
  for each row execute function fn_recalculate_crowding();

-- ── Trigger: Expire tickets automatically ─────────────────────────────────────
-- Marks tickets as used=true when expires_at passes (runs on SELECT via check)
-- Actual batch expiry is handled by the cron job; this trigger fires on UPDATE
create or replace function fn_expire_ticket()
returns trigger language plpgsql as $$
begin
  if NEW.expires_at is not null and NEW.expires_at < now() and NEW.used = false then
    NEW.used    := true;
    NEW.used_at := now();
    insert into automation_logs (event_type, entity_type, entity_id, payload)
    values ('ticket_expired', 'ticket', NEW.id::text,
            jsonb_build_object('ticket_ref', NEW.ticket_ref, 'expires_at', NEW.expires_at));
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_expire_ticket on tickets;
create trigger trg_expire_ticket
  before update on tickets
  for each row execute function fn_expire_ticket();

-- ── Trigger: Log ride deductions ──────────────────────────────────────────────
create or replace function fn_log_ride_deduction()
returns trigger language plpgsql as $$
begin
  if OLD.rides_remaining is not null
     and NEW.rides_remaining is not null
     and NEW.rides_remaining < OLD.rides_remaining then
    insert into automation_logs (event_type, entity_type, entity_id, payload)
    values (
      'ride_deducted', 'ticket', NEW.id::text,
      jsonb_build_object(
        'ticket_ref',      NEW.ticket_ref,
        'rides_before',    OLD.rides_remaining,
        'rides_after',     NEW.rides_remaining
      )
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_log_ride_deduction on tickets;
create trigger trg_log_ride_deduction
  after update on tickets
  for each row execute function fn_log_ride_deduction();

-- ── Realtime: Enable for tables that need live push ───────────────────────────
-- Each block checks pg_publication_tables before adding to avoid duplicate errors.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'automation_logs') then
    alter publication supabase_realtime add table automation_logs;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'crowding_predictions') then
    alter publication supabase_realtime add table crowding_predictions;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'daily_reports') then
    alter publication supabase_realtime add table daily_reports;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'scraped_trains') then
    alter publication supabase_realtime add table scraped_trains;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'scraped_notices') then
    alter publication supabase_realtime add table scraped_notices;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'train_updates') then
    alter publication supabase_realtime add table train_updates;
  end if;
end $$;

-- ── pg_cron: Daily Report at 04:00 UTC (06:00 SAST) ──────────────────────────
-- Requires the pg_cron extension enabled in your Supabase project.
-- Enable via: Supabase Dashboard → Database → Extensions → pg_cron
-- Then run in SQL Editor:
--
-- select cron.schedule(
--   'prasa-daily-report',
--   '0 4 * * *',
--   $$
--     select net.http_post(
--       url    := current_setting('app.supabase_url') || '/functions/v1/daily-report',
--       headers := jsonb_build_object(
--         'Content-Type',  'application/json',
--         'Authorization', 'Bearer ' || current_setting('app.service_role_key')
--       ),
--       body := '{"triggered_by":"pg_cron"}'::jsonb
--     );
--   $$
-- );

-- ── DB Webhooks (configure in Supabase Dashboard → Database → Webhooks) ────────
-- 1. notify-alert
--    • Table:  scraped_trains   Events: INSERT
--    • Table:  train_updates    Events: INSERT
--    • URL:    {SUPABASE_URL}/functions/v1/notify-alert
--    • Header: Authorization: Bearer {SUPABASE_ANON_KEY}
--
-- 2. lost-found-notify
--    • Table:  lost_found       Events: UPDATE
--    • Filter: status = 'matched'
--    • URL:    {SUPABASE_URL}/functions/v1/lost-found-notify
--    • Header: Authorization: Bearer {SUPABASE_ANON_KEY}
--
-- 3. recalculate-crowding
--    • Table:  coach_feedback   Events: INSERT
--    • URL:    {SUPABASE_URL}/functions/v1/recalculate-crowding
--    • Header: Authorization: Bearer {SUPABASE_ANON_KEY}

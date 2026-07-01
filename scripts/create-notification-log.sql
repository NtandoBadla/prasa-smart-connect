-- Run this in your Supabase SQL editor (Dashboard → SQL Editor)
-- Creates the notification_log table used to prevent duplicate notifications.

create table if not exists notification_log (
  event_key   text        primary key,
  notified_at timestamptz not null default now()
);

-- Index to speed up the delete-old-logs cleanup query
create index if not exists notification_log_notified_at_idx
  on notification_log (notified_at);

-- Optional: comment
comment on table notification_log is
  'Tracks which scrape events have already triggered subscriber notifications to prevent duplicates within a 2-hour window.';

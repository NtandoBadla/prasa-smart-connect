# PRASA Smart Connect — Automated Notification System

## Overview

The automation system monitors live train status by scraping a third-party source every 10 minutes. When a train is detected as **Delayed** or **Cancelled**, it automatically identifies every registered user subscribed to the affected stations and sends them an **email** and **SMS** notification — with no manual intervention required.

There are two parallel paths that trigger notifications:

- **Automatic** — the scraper detects a status change and fires notifications
- **Manual** — an admin posts a train update via the admin dashboard, which also fires notifications immediately

---

## Architecture

```
cttrains.co.za
      │
      ▼
 server/scraper.ts          (runs every 10 min via node-cron)
      │
      ├── stores results in Supabase
      │     ├── scraped_trains
      │     └── scraped_notices
      │
      └── triggers autoNotify
            │
            ▼
     server/autoNotify.ts
            │
            ├── filters: status = "Delayed" or "Cancelled"
            ├── resolves all affected stations along the route
            ├── checks notification_log (dedup — skip if notified < 2h ago)
            ├── queries subscribers from:
            │     ├── users.station  (home station match)
            │     └── subscriptions table  (explicit subscribe)
            │         (deduplicated by email)
            │
            └── sends via server/mailer.ts
                  ├── Email  → EmailJS API
                  └── SMS    → SMSPortal API
```

---

## Files Involved

| File | Role |
|------|------|
| `server/scraper.ts` | Fetches and parses live train status from cttrains.co.za |
| `server/autoNotify.ts` | Core automation — detects actionable events and dispatches notifications |
| `server/index.ts` | Entry point — runs the cron job that ties scraping + auto-notify together |
| `server/routes/adminUpdate.ts` | Manual admin update route — also dispatches notifications |
| `server/mailer.ts` | Email (EmailJS) and SMS (SMSPortal) sending helpers |
| `netlify/functions/api.ts` | Serverless API — exposes `/api/auto-notify` endpoint |
| `netlify/functions/scheduled-notify.ts` | Netlify Scheduled Function — calls auto-notify every 10 min |
| `scripts/create-notification-log.sql` | SQL to create the `notification_log` deduplication table |

---

## How the Scraper Works (`server/scraper.ts`)

The scraper fetches `https://cttrains.co.za/status2.php` using `axios` and parses the HTML with `cheerio`. It uses three fallback strategies to handle changes in the site's markup:

1. **Strategy 1** — looks for `.rounded-xl` cards with `.msg-row` children
2. **Strategy 2** — looks for any card-like container (`section`, `article`, `[class*='card']`) with a heading and list items
3. **Strategy 3** — scans every `<p>` and `<li>` that mentions a known train line keyword

For each message found it extracts:
- **Status** — detected by keyword matching: `cancel/suspend` → Cancelled, `delay/late` → Delayed, `on time/normal` → On Time
- **Train number** — regex `T\d{3,5}`
- **From / To station** — regex against known station list of 44 Western Cape stations
- **Delay minutes** — regex `\d+ min`
- **Reason** — captured if message mentions cable theft, signal fault, power failure, etc.

Results are cached in memory for 10 minutes (to avoid hammering the source) and persisted to the `scraped_trains` and `scraped_notices` Supabase tables.

If the scrape returns nothing, the system synthesises "On Time" rows from the `prasa_timetable` database so the frontend always has something to display.

---

## How Auto-Notify Works (`server/autoNotify.ts`)

This is the engine that connects scrape results to subscriber notifications.

### Step 1 — Filter actionable trains

```typescript
const actionable = trains.filter(
  (t) => t.status === "Delayed" || t.status === "Cancelled"
);
```

Only trains with a real problem trigger notifications. "On Time" and "Update" statuses are ignored.

### Step 2 — Deduplication via `notification_log`

Each event is identified by a unique key:

```typescript
function eventKey(train: ScrapedTrain): string {
  return `${train.train_no}|${train.status}|${train.delay_min}`;
}
```

Before notifying, the system checks the `notification_log` table in Supabase to see if this exact event was already notified in the last 2 hours. This prevents the same passengers from receiving the same alert every 10 minutes for a delay that is ongoing.

Log entries older than 2 hours are automatically pruned on each run so that a train that is *still* delayed after 2 hours will trigger a fresh notification cycle.

### Step 3 — Resolve affected stations

A delay on the Northern Line between Bellville and Cape Town affects every station in between. The system maps each train to the full list of stops it passes through:

```
Northern Line stops:
Cape Town → Woodstock → Salt River → Pinelands → Goodwood → Parow → Bellville → Stellenbosch
```

All passengers travelling through any of those intermediate stations are considered affected and will receive a notification.

### Step 4 — Resolve subscribers

For each affected station, subscribers are fetched from two sources and merged:

```typescript
// Source 1: users whose home station matches
supabase.from("users").select("email, phone").in("station", stations)

// Source 2: users who explicitly subscribed via /api/subscribe
supabase.from("subscriptions")
  .select("station, user_id, users!inner(email, phone)")
  .in("station", stations)
```

Results are deduplicated by email so no one receives the same notification twice even if they appear in both tables.

### Step 5 — Send notifications

Email is sent via `notifySubscribers()` in `mailer.ts`, which fans out using `Promise.allSettled` so one failing email does not block the others.

SMS is sent via SMSPortal for any subscriber who has a phone number on file. Phone numbers are automatically normalised to the South African `+27XXXXXXXXX` format.

---

## Cron Job (`server/index.ts`)

On the standalone Node server, a `node-cron` schedule fires every 10 minutes:

```typescript
async function scrapeAndNotify() {
  const { trains, notices } = await runScrape();
  const { notified, failed } = await runAutoNotify(trains, notices);
}

cron.schedule("*/10 * * * *", () => {
  scrapeAndNotify().catch(console.error);
});
```

It also runs once immediately on server startup so there is no wait for the first cycle.

---

## Manual Admin Updates (`server/routes/adminUpdate.ts`)

When an admin posts a train update from the dashboard (`POST /api/admin/update`), the system:

1. Saves the update record to the `train_updates` table
2. Queries subscribers from **both** `users.station` and the `subscriptions` table (deduplicated)
3. Sends email notifications via `notifySubscribers()`
4. Sends SMS notifications via `sendSms()` for users with a phone number

This was also fixed as part of this implementation. Previously the manual update only queried `users.station` and completely ignored the `subscriptions` table, meaning users who subscribed via the app's subscribe feature never received manual updates.

---

## Netlify Serverless Path

Netlify functions are stateless and cannot run a persistent cron job. Two components handle this:

### `/api/auto-notify` endpoint (`netlify/functions/api.ts`)

A protected POST endpoint that triggers a full scrape-and-notify cycle on demand:

```
POST /api/auto-notify
Header: x-notify-secret: <NOTIFY_SECRET>
```

It requires the `NOTIFY_SECRET` environment variable to match, preventing unauthorised callers from triggering mass notifications.

### Netlify Scheduled Function (`netlify/functions/scheduled-notify.ts`)

A Netlify Scheduled Function configured to run every 10 minutes. It calls the `/api/auto-notify` endpoint on the same deployment:

```typescript
export const config: Config = {
  schedule: "*/10 * * * *",
};
```

This is also declared in `netlify.toml`:

```toml
[functions."scheduled-notify"]
  schedule = "*/10 * * * *"
```

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `scraped_trains` | Latest train status from the live scrape |
| `scraped_notices` | Raw announcement text from the live scrape |
| `users` | Registered users with email, phone, and home station |
| `subscriptions` | Explicit station subscriptions (user_id + station) |
| `train_updates` | Manual admin update records |
| `notification_log` | Deduplication log — prevents repeat notifications within 2 hours |

The `notification_log` table must be created before deploying. The SQL is in `scripts/create-notification-log.sql`:

```sql
create table if not exists notification_log (
  event_key   text        primary key,
  notified_at timestamptz not null default now()
);
create index if not exists notification_log_notified_at_idx
  on notification_log (notified_at);
```

---

## Notification Channels

### Email — EmailJS

Configured via environment variables:

```
EMAILJS_SERVICE_ID
EMAILJS_TEMPLATE_ID
EMAILJS_PUBLIC_KEY
EMAILJS_PRIVATE_KEY
```

The template receives these parameters: `to_email`, `train_no`, `line`, `station`, `status`, `reason`, `updated_at`.

### SMS — SMSPortal

Configured via environment variables:

```
SMSPORTAL_CLIENT_ID
SMSPORTAL_CLIENT_SECRET
```

SMSPortal uses bearer token authentication. The token is cached for 55 minutes (tokens are valid for 1 hour) to avoid re-authenticating on every send. Phone numbers are automatically normalised from `0XXXXXXXXX` to `+27XXXXXXXXX`.

---

## Environment Variables Required

| Variable | Where to set | Purpose |
|----------|-------------|---------|
| `NOTIFY_SECRET` | `.env` + Netlify | Protects the `/api/auto-notify` endpoint |
| `SUPABASE_URL` | `.env` + Netlify | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | `.env` + Netlify | Supabase service role key |
| `EMAILJS_SERVICE_ID` | `.env` + Netlify | EmailJS service |
| `EMAILJS_TEMPLATE_ID` | `.env` + Netlify | EmailJS alert template |
| `EMAILJS_PUBLIC_KEY` | `.env` + Netlify | EmailJS public key |
| `EMAILJS_PRIVATE_KEY` | `.env` + Netlify | EmailJS private key |
| `SMSPORTAL_CLIENT_ID` | `.env` + Netlify | SMSPortal credentials |
| `SMSPORTAL_CLIENT_SECRET` | `.env` + Netlify | SMSPortal credentials |
| `URL` | Netlify only | Deployment URL (used by scheduled-notify to call the API) |

---

## Test Results

The system was tested live on 1 July 2026. Server logs confirmed:

```
[scraper] status2.php → 10 trains, 10 notices
[autoNotify] Train T9914 (Delayed) affects stations: Chris Hani, Cape Town
[SMS] Sent via SMSPortal to +27746148629
[autoNotify] Train T9914: notified 2 subscriber(s), 0 failed.
[autoNotify] Sent 2 notification(s), 0 failed.

[adminUpdate] station="Du Toit" matched_users=1
[SMS] Sent via SMSPorttal to +27746148629
[adminUpdate] SMS results: [ 'fulfilled' ]
```

A manual Du Toit delay update (`Train T4501, Northern Line, Delayed 15 min, Signal fault`) was dispatched and confirmed:

```json
{
  "message": "Train update saved and notifications dispatched.",
  "notified": 1,
  "failed": 0
}
```

# PRASA Smart Connect

A full-stack smart commuter platform for PRASA Metrorail passengers in the Western Cape, South Africa. The platform provides real-time train tracking, trip planning, service alerts, AI-powered chatbot assistance, lost & found management, safety incident reporting, ticket generation, crowd sentiment analysis, and automated database-driven notifications — all in one place.

---

## Table of Contents

- [About the Project](#about-the-project)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [Database Setup](#database-setup)
- [Supabase Automation](#supabase-automation)
- [Deployment](#deployment)
- [API Overview](#api-overview)
- [Admin Panel](#admin-panel)

---

## About the Project

PRASA Smart Connect is a production-ready web application built to improve the daily commuting experience for Cape Town Metrorail passengers. It aggregates live train status data, provides journey planning tools, enables passengers to report lost items and safety incidents, and allows admins to push real-time service updates with automatic email and SMS notifications to subscribers.

The application is deployed on **Netlify** with a **Supabase** PostgreSQL backend, **Supabase Edge Functions** for serverless automation, and **EmailJS** + **SMSPortal** for transactional notifications.

---

## Features

| Feature | Route | Description |
|---|---|---|
| Home | `/` | Landing page with network overview and quick links |
| Trip Search | `/search` | Search trains between any two stations with ticket generation |
| Trip Planner | `/planner` | Multi-leg journey planner with transfer suggestions |
| Live Tracking | `/tracking` | Simulated real-time train positions across the network |
| Service Alerts | `/alerts` | Live service disruption alerts by line |
| Interactive Map | `/map` | Leaflet map with real GPS coordinates for all stations and lines |
| News | `/news` | Latest PRASA news with auto-refresh |
| Fares | `/fares` | Fare information by line and zone |
| Crowding & Sentiment | `/crowding` | AI-powered crowd level and safety rating from passenger feedback |
| Lost & Found | `/lost-found` | Report lost items and receive email/SMS notification when found |
| Safety Reports | `/safety` | Report safety incidents at stations |
| My Tickets | `/tickets` | View generated ticket history |
| Register | `/register` | Subscribe to station-specific email alerts |
| Admin Panel | `/admin` | Full admin dashboard (protected) |
| AI Chatbot | `/chatbot` | Intelligent rule-based + OpenAI-powered train assistant |

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 19 | UI framework |
| TypeScript | Type safety across the entire codebase |
| TanStack Router v1 | File-based client-side routing with type-safe search params |
| TanStack Query v5 | Server state management and data fetching |
| Tailwind CSS v4 | Utility-first styling |
| Radix UI | Accessible headless UI primitives |
| Leaflet + React Leaflet | Interactive map with OpenStreetMap tiles (no API key required) |
| Recharts | Data visualisation charts for sentiment analysis |
| Lucide React | Icon library |
| Zod | Runtime schema validation |

### Backend
| Technology | Purpose |
|---|---|
| Express v5 | REST API server |
| TypeScript | Type-safe server code |
| tsx | TypeScript execution and hot-reload for development |
| node-cron | Scheduled scraping every 10 minutes |
| Cheerio + Axios | Web scraping live train status from cttrains.co.za |
| serverless-http | Wraps Express for Netlify Functions deployment |

### Database & Services
| Service | Purpose |
|---|---|
| Supabase (PostgreSQL) | Primary database — all application tables |
| Supabase Edge Functions | Serverless automation — alerts, notifications, daily reports |
| Supabase Realtime | Live push for train updates, alerts, automation logs |
| EmailJS | Transactional email — subscriber alerts, lost & found notifications |
| SMSPortal | SMS notifications — train alerts, lost & found (optional) |
| Hugging Face Inference API | Sentiment analysis for coach feedback (distilroberta-base) |
| OpenAI API | AI chatbot responses (optional, falls back to rule-based) |
| SerpAPI | News scraping (optional) |
| Stripe | Payment processing for ticket purchases |

### Deployment
| Tool | Purpose |
|---|---|
| Netlify | Frontend hosting + serverless API functions |
| Netlify Functions | Serverless Express backend via `netlify/functions/api.ts` |
| Vite | Frontend build tool |

---

## Project Structure

```
prasa-smart-connect/
├── netlify/
│   └── functions/
│       └── api.ts                  # Serverless Express app (production backend)
├── server/
│   ├── middleware/                 # Auth middleware
│   ├── routes/
│   │   ├── adminUpdate.ts          # Train status updates + subscriber notifications
│   │   ├── chatbot.ts              # AI chatbot endpoint
│   │   ├── lostFound.ts            # Lost & found public endpoints
│   │   ├── register.ts             # User registration
│   │   ├── safety.ts               # Safety incident reporting
│   │   ├── sentiment.ts            # VADER + HuggingFace sentiment analysis
│   │   ├── stationSearch.ts        # Station search (OpenStreetMap)
│   │   ├── subscribe.ts            # Station alert subscriptions
│   │   └── tickets.ts              # Ticket generation and history
│   ├── automation.ts               # Automation helpers (ticket expiry batch job)
│   ├── db.ts                       # Supabase client
│   ├── index.ts                    # Local development Express server
│   ├── mailer.ts                   # EmailJS email sending functions
│   ├── scraper.ts                  # cttrains.co.za live train scraper
│   └── validate.ts                 # Zod validation schemas
├── supabase/
│   ├── functions/
│   │   ├── notify-alert/           # Edge Function — email/SMS on train alerts
│   │   ├── lost-found-notify/      # Edge Function — email/SMS on item matched
│   │   ├── recalculate-crowding/   # Edge Function — refresh crowding snapshot
│   │   └── daily-report/           # Edge Function — daily stats report (pg_cron)
│   └── migrations/
│       └── automation.sql          # Automation tables + DB triggers
├── src/
│   ├── components/                 # Shared UI components (Header, Footer, Chatbot, etc.)
│   ├── data/
│   │   ├── prasa.ts                # Station data, schedule seeds, line definitions
│   │   └── extras.ts               # News types, trip planner logic
│   ├── hooks/                      # Custom React hooks
│   ├── lib/
│   │   ├── api.ts                  # Frontend API client (all fetch calls)
│   │   └── utils.ts                # Utility functions
│   ├── routes/
│   │   ├── admin/                  # Admin dashboard and login
│   │   └── *.tsx                   # All page routes
│   └── main.tsx                    # React entry point
├── scripts/
│   ├── test-connections.ts         # Test all external service connections
│   └── seed-timetable.ts           # Seed PRASA timetable data
├── .env                            # Local environment variables (not committed)
├── .env.example                    # Environment variable template
├── netlify.toml                    # Netlify build and redirect configuration
├── supabase_migration.sql          # Core database schema
├── package.json
├── tsconfig.json                   # Frontend TypeScript config
├── tsconfig.server.json            # Backend TypeScript config
└── vite.config.ts                  # Vite build configuration
```

---

## Prerequisites

- **Node.js** v20 or higher
- **npm** v9 or higher
- A **Supabase** project — [supabase.com](https://supabase.com)
- An **EmailJS** account — [emailjs.com](https://emailjs.com)
- **Supabase CLI** — installed via `npm install -g supabase` or used via `npx supabase`

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/prasa-smart-connect.git
cd prasa-smart-connect
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env
```

Fill in your values — see [Environment Variables](#environment-variables) below.

### 4. Set up the database

Run both SQL files in order inside **Supabase Dashboard → SQL Editor**:

1. `supabase_migration.sql` — core tables
2. `supabase/migrations/automation.sql` — automation tables + DB triggers

### 5. Test your connections

```bash
npm run test:connections
```

---

## Environment Variables

```env
# Server
PORT=3001
VITE_API_URL=http://localhost:3001

# Admin credentials
ADMIN_USER=admin
ADMIN_PASS=your-admin-password
ADMIN_JWT_SECRET=a-long-random-secret-string
ADMIN_EMAIL=your-admin@email.com

# Security portal
SECURITY_USER=security
SECURITY_PASS=security2025

# Supabase — Project Settings → API
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # same key, used by Edge Functions

# EmailJS — emailjs.com → Account → API Keys
EMAILJS_SERVICE_ID=service_xxxxxxx
EMAILJS_TEMPLATE_ID=template_xxxxxxx         # General alerts / lost item confirmation
EMAILJS_FOUND_TEMPLATE_ID=template_xxxxxxx   # "Item found" notification to passenger
EMAILJS_REPORT_TEMPLATE_ID=template_xxxxxxx  # Daily report email to admin
EMAILJS_PUBLIC_KEY=your-public-key
EMAILJS_PRIVATE_KEY=your-private-key

# SMSPortal — optional, smsportal.com
SMSPORTAL_CLIENT_ID=your-client-id
SMSPORTAL_CLIENT_SECRET=your-client-secret

# OpenAI — optional, falls back to rule-based chatbot
OPENAI_API_KEY=sk-...

# Hugging Face — optional, sentiment falls back to VADER
VITE_HF_API_TOKEN=hf_...

# SerpAPI — optional, news scraping
SERPAPI_KEY=your-serpapi-key

# Stripe — ticket payments
STRIPE_SECRET_KEY=sk_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_...

# Africa's Talking — optional SMS fallback
AT_USERNAME=your-username
AT_API_KEY=your-api-key

# Google Maps — optional
VITE_GOOGLE_MAPS_API_KEY=your-key
```

> For **Netlify deployment**, add all variables in:
> Netlify Dashboard → Site configuration → Environment variables

---

## Running the App

The app requires two processes running simultaneously in development.

**Terminal 1 — Backend:**
```bash
npm run server
# Available at http://localhost:3001
```

**Terminal 2 — Frontend:**
```bash
npm run dev
# Available at http://localhost:8080
```

### Other scripts

```bash
npm run build             # Production build
npm run preview           # Preview production build locally
npm run lint              # Run ESLint
npm run format            # Format with Prettier
npm run test:connections  # Test all external service connections
```

---

## Database Setup

### Core tables (`supabase_migration.sql`)

| Table | Description |
|---|---|
| `users` | Registered subscribers |
| `subscriptions` | Station alert subscriptions |
| `train_updates` | Admin-posted train status updates |
| `tickets` | Generated passenger tickets |
| `ticket_scans` | Security officer ticket scan log |
| `ticket_recovery_log` | Ticket recovery audit trail |
| `lost_found` | Lost item reports |
| `safety_incidents` | Safety reports from passengers |
| `coach_feedback` | Crowding and sentiment submissions |
| `scraped_trains` | Live train data from the scraper |
| `scraped_notices` | Live service notices from the scraper |
| `station_cache` | Cached station search results |
| `prasa_routes` | Official PRASA route definitions |
| `prasa_stations` | Ordered stop list per route |
| `prasa_timetable` | Individual train stop times |

### Automation tables (`supabase/migrations/automation.sql`)

| Table | Description |
|---|---|
| `automation_logs` | Audit log for all automated events |
| `crowding_predictions` | Materialised crowding/safety scores per line and station |
| `daily_reports` | Daily aggregated statistics |

---

## Supabase Automation

The platform uses a fully automated pipeline built on Supabase database triggers, Edge Functions, DB Webhooks, and pg_cron.

### Database Triggers (run automatically in PostgreSQL)

| Trigger | Table | Event | Action |
|---|---|---|---|
| `trg_recalculate_crowding` | `coach_feedback` | INSERT | Recalculates crowding and safety scores in `crowding_predictions` |
| `trg_expire_ticket` | `tickets` | UPDATE | Auto-marks expired tickets as used |
| `trg_log_ride_deduction` | `tickets` | UPDATE | Logs ride deductions to `automation_logs` |

### Edge Functions (deployed to Supabase)

| Function | Trigger | Description |
|---|---|---|
| `notify-alert` | DB Webhook on `train_updates` INSERT or `scraped_trains` INSERT | Sends email (EmailJS) + SMS (SMSPortal) to subscribers at the affected station |
| `lost-found-notify` | DB Webhook on `lost_found` UPDATE where status = `matched` | Notifies passenger via email or SMS that their item was found |
| `recalculate-crowding` | DB Webhook on `coach_feedback` INSERT | Refreshes the crowding prediction snapshot used by the chatbot |
| `daily-report` | pg_cron at 04:00 UTC (06:00 SAST) | Aggregates daily stats, writes to `daily_reports`, emails admin |

### Deploying Edge Functions

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase functions deploy notify-alert
npx supabase functions deploy lost-found-notify
npx supabase functions deploy recalculate-crowding
npx supabase functions deploy daily-report
```

Set secrets:
```bash
npx supabase secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... EMAILJS_SERVICE_ID=... # etc.
```

### DB Webhooks (configure in Supabase Dashboard → Database → Webhooks)

| Webhook name | Table | Event | URL |
|---|---|---|---|
| `notify-alert` | `train_updates` | INSERT | `.../functions/v1/notify-alert` |
| `notify-alert-scraper` | `scraped_trains` | INSERT | `.../functions/v1/notify-alert` |
| `lost-found-notify` | `lost_found` | UPDATE | `.../functions/v1/lost-found-notify` |
| `recalculate-crowding` | `coach_feedback` | INSERT | `.../functions/v1/recalculate-crowding` |

Add header for each: `Authorization: Bearer <your-service-role-key>`

### Realtime (enabled for live push)

`automation_logs`, `crowding_predictions`, `daily_reports`, `scraped_trains`, `scraped_notices`, `train_updates`

### pg_cron Daily Report

Enable in Supabase SQL Editor:
```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'prasa-daily-report', '0 4 * * *',
  $$
    select net.http_post(
      url     := 'https://your-project.supabase.co/functions/v1/daily-report',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <service-role-key>'),
      body    := '{"triggered_by":"pg_cron"}'::jsonb
    );
  $$
);
```

---

## Deployment

The project is configured for **Netlify** deployment out of the box.

### Steps

1. Push your code to a GitHub repository
2. Connect the repository to Netlify
3. Netlify auto-detects settings from `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist/client`
   - Functions directory: `netlify/functions`
4. Add all environment variables in the Netlify dashboard
5. Deploy

All `/api/*` requests are proxied to the Netlify serverless function via the redirect rule in `netlify.toml`.

---

## API Overview

All endpoints are prefixed with `/api/`.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/schedules` | Public | All train schedules |
| GET | `/api/alerts` | Public | Active service alerts |
| GET | `/api/news` | Public | Latest news items |
| POST | `/api/register` | Public | Register a new user |
| POST | `/api/subscribe` | Public | Subscribe to station alerts |
| POST | `/api/lost-found` | Public | Submit a lost item report |
| POST | `/api/safety` | Public | Submit a safety incident report |
| POST | `/api/tickets` | Public | Generate a ticket |
| GET | `/api/tickets/:userId` | Public | Get ticket history |
| POST | `/api/chatbot` | Public | Send a chatbot message |
| POST | `/api/sentiment` | Public | Analyse sentiment from text |
| GET | `/api/health` | Public | Service health check |
| POST | `/api/admin/login` | Public | Admin login |
| GET | `/api/admin/stats` | Admin | Dashboard statistics |
| GET | `/api/admin/lost-found` | Admin | All lost & found reports |
| PATCH | `/api/admin/lost-found/:id` | Admin | Update lost item status (triggers email) |
| GET | `/api/admin/safety` | Admin | All safety incident reports |
| PATCH | `/api/admin/safety/:id` | Admin | Update safety incident status |
| POST | `/api/admin/update` | Admin | Post a train status update + notify subscribers |
| GET | `/api/admin/subscribers` | Admin | All registered subscribers |

---

## Admin Panel

Access the admin panel at `/admin/login`.

Default credentials (change these in your `.env`):
- Username: `admin`
- Password: `prasa2025`

The admin panel includes:
- **Overview** — network statistics at a glance
- **Schedules** — create, edit, and delete train schedules
- **Alerts** — post and manage service alerts
- **News** — publish news articles
- **Train Update** — push live status updates with automatic subscriber email + SMS notifications
- **Subscribers** — view all registered users
- **Safety Reports** — review and resolve safety incidents
- **Timetable** — add upcoming trains to the database timetable
- **Coach Feedback** — view passenger sentiment analysis by coach
- **Lost & Found** — manage lost item reports and mark items as found (triggers email/SMS to passenger)

---

Built for PRASA Metrorail Western Cape commuters.

# PRASA Smart Connect — System Documentation

**Version:** 1.0  
**Platform:** Web Application (React + Express)  
**Deployment:** Netlify (frontend + serverless functions) + Supabase (PostgreSQL)  
**Target Users:** Metrorail commuters and tourists in the Western Cape, South Africa

---

## 1. Overview

PRASA Smart Connect is a full-stack smart commuter platform built for Metrorail passengers in Cape Town. It combines real-time train data, AI-powered analysis, safety tools and tourist features into a single web application. The system is designed to improve the daily commuting experience by giving passengers accurate, timely and actionable information about train services.

The platform runs entirely in the browser (no app download required) and is accessible on any device. All core features work without a login — passengers can report incidents, generate tickets and use the AI chatbot without creating an account.

---

## 2. System Architecture

### 2.1 Frontend
- **Framework:** React 19 with TypeScript
- **Routing:** TanStack Router v1 (file-based, type-safe URL search params)
- **Data Fetching:** TanStack Query v5 (server state, caching, auto-refresh)
- **Styling:** Tailwind CSS v4
- **UI Components:** Radix UI headless primitives
- **Maps:** Google Maps JavaScript API (with custom styles)
- **Charts:** Recharts
- **Build Tool:** Vite

### 2.2 Backend
- **Framework:** Express v5 with TypeScript
- **Runtime:** Node.js v20 (local dev via `tsx` hot-reload)
- **Serverless:** `serverless-http` wraps Express for Netlify Functions
- **Scheduled Jobs:** `node-cron` — scrapes live train data every 10 minutes
- **Scraping:** Axios + Cheerio (scrapes cttrains.co.za for live train statuses)

### 2.3 Database
- **Provider:** Supabase (PostgreSQL)
- **Tables:** `users`, `subscriptions`, `train_updates`, `tickets`, `lost_found`, `safety_incidents`, `coach_feedback`, `scraped_trains`, `scraped_notices`, `station_cache`

### 2.4 External Services
| Service | Purpose |
|---|---|
| Supabase | Primary database for all persisted data |
| EmailJS | Transactional emails — subscriber alerts, lost item notifications |
| Hugging Face Inference API | Emotion/sentiment analysis (distilroberta-base model) |
| OpenAI API | AI chatbot responses (optional — falls back to rule-based) |
| Google Maps JavaScript API | Interactive map with station markers and transit layer |
| SerpAPI | News article scraping (optional) |

### 2.5 Deployment
- **Frontend:** Netlify static hosting — built from `dist/client`
- **Backend:** Netlify Functions — `netlify/functions/api.ts` wraps the full Express app
- **Routing:** All `/api/*` requests are proxied to the serverless function via `netlify.toml` redirect rules

---

## 3. Train Network Data

The system covers the **PRASA Metrorail Western Cape** network with 4 lines and 23 stations.

### 3.1 Lines
| Line | Terminus A | Terminus B | Stations |
|---|---|---|---|
| Southern Line | Cape Town | Simon's Town | 13 |
| Northern Line | Cape Town | Stellenbosch | 8 |
| Central Line | Cape Town | Khayelitsha | 8 |
| Cape Flats Line | Cape Town | Retreat | 6 |

### 3.2 Stations (23 total)
Cape Town, Woodstock, Salt River, Observatory, Mowbray, Rondebosch, Newlands, Claremont, Wynberg, Retreat, Muizenberg, Fish Hoek, Simon's Town, Bellville, Parow, Goodwood, Khayelitsha, Mitchells Plain, Philippi, Nyanga, Langa, Pinelands, Stellenbosch

### 3.3 Schedule Data
- 54 seed train schedules are seeded in `src/data/prasa.ts` covering all lines in both directions
- Schedules include: train number, line, stops list, departure time, arrival time, duration, platform, status (On Time / Delayed / Cancelled) and base fare
- Live schedule overrides can be posted by admins and are stored in Supabase `train_updates`
- The frontend merges seed data with live API data — if the backend is unavailable it falls back to seed data

---

## 4. Features

### 4.1 Home Page (`/`)
The landing page shows:
- Hero section with call-to-action links to Live Trains and Service Alerts
- Feature strip highlighting Smart Route Search, Live Tracking and AI Assistant
- Live Announcements panel — pulls real-time admin train updates and scraped notices from cttrains.co.za, auto-refreshes every 5 minutes
- Colour-coded announcement cards: red (cancellations), orange (delays), blue (general info)

---

### 4.2 Trip Search (`/search`)
Allows passengers to find trains between any two stations.

**How it works:**
1. Passenger selects departure station, destination and optional departure time
2. The system searches all schedules (live from API, falling back to seed data) for trains where both stations appear in the stops list in the correct order
3. Results are sorted by departure time
4. If no trains run after the requested time, the system wraps around and shows all available services on the route with a warning banner
5. Each result shows a TrainCard with line, status, platform, departure/arrival and fare
6. Passengers can generate a digital ticket for any result

**Ticket generation:**
- Clicking "Generate Ticket" opens a confirmation modal with full journey details
- On confirm, a ticket is created via `POST /api/tickets` and saved to Supabase
- A unique reference code (e.g. `TKT-ABC123`) is displayed and the ticket is saved to the passenger's history

---

### 4.3 Trip Planner (`/planner`)
Advanced journey planner supporting multi-leg trips with transfers.

**How it works:**
- Uses the `planTrip()` function in `src/data/extras.ts`
- Finds direct trains first, then tries one-transfer routes via hub stations (Cape Town, Salt River, Bellville, Retreat)
- For transfer routes, ensures a minimum 5-minute connection time and maximum 60-minute wait at the hub
- Returns up to 6 journey options sorted by departure time and total duration
- Each option shows all legs, transfer points, total duration and total fare

**Additional features:**
- Full timetable collapsible panel shows every train on the searched route
- Saved routes panel — returns users see their previously searched routes
- Book & get ticket button generates a downloadable `.txt` ticket file for multi-leg journeys

---

### 4.4 Live Train Tracking (`/tracking`)
Displays simulated real-time positions for all 54 trains across the network.

**How it works:**
- A timer ticks every 6 seconds, advancing each train's progress along its stops list
- Each train card shows: current stop, ETA to terminus, progress bar, status badge
- Status colours: green (On Time), orange (Delayed), red (Cancelled)
- Share Journey button on each card generates a shareable link with current train position

**Note:** This is a simulation based on schedule data. It is not connected to real GPS tracking hardware.

---

### 4.5 Service Alerts (`/alerts`)
Displays current service disruptions with severity levels.

- Seed alerts are loaded from `src/data/prasa.ts`
- Admin-posted alerts from Supabase override/supplement seed data
- Three severity levels: Critical (red), Warning (orange), Info (blue)
- Each alert shows title, affected line, full message and posted timestamp

---

### 4.6 Interactive Map (`/map`)
A Google Maps-powered interactive map of the Metrorail network with crime hotspot overlays.

**Map layers:**
- Custom styled base map (muted colours, highlighted transit infrastructure)
- Google Transit Layer showing all public transport routes
- Crime hotspot markers — one circle marker per station, colour-coded by risk level

**Crime hotspot markers:**
- Red: High Risk
- Orange: Moderate
- Green: Safe
- Clicking a marker opens an info window showing station name, risk level badge, feedback count, incident count, negative feedback percentage and VADER sentiment score
- A legend is pinned to the bottom-left of the map
- Risk is calculated from real passenger feedback and safety incident data (see Section 4.12)

---

### 4.7 Fares & Tickets (`/fares`)
A fare calculator and digital ticket generator.

**Fare calculation:**
- Base fares by line: Southern R14.50, Northern R13.00, Central R12.50, Cape Flats R12.00
- Ticket types: Single (×1), Return (×1.8), Weekly (×8), Monthly (×28)
- Travel classes: Metro (×1), MetroPlus (×1.6)
- Formula: `base fare × ticket multiplier × class multiplier`

**E-Ticket:**
- Generated on-screen with all journey details, a deterministic fake QR code for visual display and a unique reference number
- Downloadable as a PDF via the `downloadTicketPDF()` utility (uses canvas/jsPDF)

---

### 4.8 Crowding & Best Coach (`/crowding`)
Helps passengers find the least crowded coach before boarding.

**How it works:**
- Passenger selects From station, To station (full 23-station list), then filters to matching trains
- Selects departure time (defaults to current time)
- The system calculates an 8-coach load profile using:
  - Base load by line (Central Line peak: 92%, Southern Line off-peak: 40%)
  - Peak hour detection (Mon–Fri 06:00–09:00 and 16:00–19:00)
  - Coach position bias (front coaches fill first at Cape Town terminus)
- Visual coach layout shows each coach coloured by occupancy level (green/orange/red/dark red)
- AI recommendation highlights the least crowded coach

**Passenger feedback:**
- Passengers can type a free-text description of their experience on the train
- On submit, two AI models analyse the text simultaneously:
  - **VADER** (local, runs in-browser) — rule-based sentiment giving a compound score from -1 to +1
  - **Hugging Face** (emotion model `j-hartmann/emotion-english-distilroberta-base`) — classifies emotion and normalises to positive/negative/neutral
- Results are overlaid on the relevant coach card
- Feedback is saved to Supabase `coach_feedback` table with station, line, VADER score, HF label and confidence
- This data feeds into the Crime Hotspot Detection system

---

### 4.9 Crime Hotspot Detection (`/crime-map`)
A risk assessment dashboard showing safety levels for all 23 stations based on real passenger data.

**Risk calculation:**
The risk score for each station is calculated from two data sources:

1. **Coach Feedback** (from the Crowding page) — 70% of the score
   - Average VADER compound score (40% weight) — measures how negative the text sentiment is
   - Negative feedback percentage (30% weight) — proportion of submissions flagged as negative by VADER or Hugging Face

2. **Safety Incidents** (from the Safety page) — 30% of the score
   - Number of reported incidents capped at 5 for normalisation

**Risk thresholds:**
- High Risk: score ≥ 0.55 OR 3+ reported incidents
- Moderate: score ≥ 0.35 OR 1–2 reported incidents
- Safe: score < 0.35 and no incidents

**Station expansion:**
A key accuracy feature — when a passenger submits feedback for a train from Cape Town to Khayelitsha on the Central Line, the system does not only count Cape Town and Khayelitsha. It expands the feedback to all intermediate stops along the route (Woodstock, Salt River, Langa, Nyanga, Philippi, Mitchells Plain) since those stations are also affected by the conditions reported.

**Display:**
- Summary cards showing count of High Risk / Moderate / Safe stations
- Filter buttons to show only stations of a specific risk level
- Station cards showing risk badge, score bar, feedback stats, incident count and top incident type

---

### 4.10 Lost & Found (`/lost-found`)
Enables passengers to report lost items and receive email notifications if their item is found.

**Reporting a lost item:**
1. Passenger enters item description, station, date and contact (email or phone)
2. Report is saved to Supabase `lost_found` table
3. A unique reference ID is generated and displayed in a modal
4. Passenger is advised to save the reference ID

**Finding an item:**
- When an admin marks an item as "matched" in the Admin Panel, an automated email is sent to the passenger's contact address via EmailJS
- Email uses the `EMAILJS_FOUND_TEMPLATE_ID` template with item details, station and dates

**Data privacy:**
- Only the reference ID is shown publicly — the passenger's actual contact details are stored privately in Supabase and never exposed via the public API

---

### 4.11 Safety & SOS (`/safety`)
Emergency contacts and incident reporting for passengers.

**Emergency contacts (tap-to-call):**
- PRASA Protection Services: 0800 65 64 63
- SAPS Emergency: 10111
- Medical Emergency: 10177
- Fire Brigade: 107

**Incident reporting:**
- Passenger selects incident type (Suspicious activity, Theft/robbery, Damage/vandalism, Medical assistance, Other), station and provides details
- Saved to Supabase `safety_incidents` table with status "pending"
- Admin can review and update status via the Admin Panel
- This data also feeds into the Crime Hotspot risk scores

**Safety tips:**
- Four built-in safety tips displayed below the form

---

### 4.12 Register for Alerts (`/register`)
Allows passengers to subscribe to train status notifications for their home station.

**Registration:**
- Passenger provides email, optional phone number (South African format validated) and home station
- Account created in Supabase `users` table
- Can subscribe to additional stations after registration (saved to `subscriptions` table)

**What subscribers receive:**
- Instant email when a train at their subscribed station is delayed or cancelled
- The reason for the disruption (if known)
- Alternative train suggestions
- Time the update was posted

---

### 4.13 My Tickets (`/tickets`)
Ticket history page showing all previously generated tickets for a passenger.

- Passenger enters their user ID to retrieve their ticket history
- Tickets are fetched from Supabase `tickets` table
- Each ticket shows reference, route, train, departure/arrival times, fare and booking date

---

### 4.14 News (`/news`)
Latest PRASA-related news articles.

- Fetches from `/api/news` endpoint
- Admin can create, edit and delete news articles via the Admin Panel
- Auto-refreshes every 2 minutes
- Categories: Network, Upgrade, Community, Press

---

### 4.15 Tourist Mode (`/tourist`)
A guided tour planner combining Metrorail routes with real tourist attractions.

**How it works:**
- Passenger selects departure station and destination (filtered to stations with known attractions)
- System builds an itinerary: train step(s), walking directions, then attraction cards
- For stations not directly connected, it suggests a transfer via Cape Town

**Attractions database:**
- 70+ real attractions across 19 of the 23 stations
- Each attraction includes: name, category, walking distance from station, practical tip, opening hours, entry fee and Google Maps link
- Categories: Beach, Nature, Culture, Food & Wine, History, Family, Adventure
- Filter buttons allow browsing by category

**Browse panel:**
- Before planning a route, a grid of all tourist-accessible stations is shown with top attraction previews

---

### 4.16 AI Chatbot
A floating chatbot available on every page.

**How it works:**
- Messages are sent to `POST /api/chatbot`
- If `OPENAI_API_KEY` is configured, responses are generated by GPT with a PRASA-specific system prompt covering schedules, fares, stations and safety
- If OpenAI is not configured, a rule-based fallback handles common questions about schedules, fares, lines and safety
- The chatbot also uses the `crowdingAdvice()` function to answer questions about train crowding

---

### 4.17 Admin Panel (`/admin`)
A protected dashboard for PRASA staff to manage the platform.

**Authentication:**
- JWT-style token using HMAC-SHA256 — stateless, works across Netlify serverless cold starts
- Credentials set via `ADMIN_USER` and `ADMIN_PASS` environment variables

**Admin features:**
| Section | Functionality |
|---|---|
| Overview | Network statistics — total schedules, on-time %, delayed, cancelled, total alerts, subscribers |
| Schedules | Create, edit and delete train schedules |
| Alerts | Post, edit and delete service alerts (immediately visible to all users) |
| News | Publish, edit and delete news articles |
| Train Update | Post live train status updates — automatically emails all subscribers for the affected station |
| Subscribers | View all registered users and their subscribed stations |
| Safety Reports | Review all safety incident reports, update status (pending → investigating → resolved) |
| Timetable | Add upcoming train entries to the database timetable |
| Coach Feedback | View all passenger sentiment submissions with VADER and HF analysis |
| Lost & Found | View all lost item reports, mark items as found (triggers automated email to passenger) |

---

## 5. Multilingual Support

The platform supports 5 languages via the `i18n.ts` translation system:

| Code | Language |
|---|---|
| en | English |
| af | Afrikaans |
| xh | isiXhosa |
| zu | isiZulu |
| st | Sesotho |

- Language selection is available in the Header
- All UI labels, page titles and descriptive text are translated
- The selected language is stored in React context and applied globally

---

## 6. Sentiment Analysis System

Two sentiment models run in parallel for all passenger feedback:

### 6.1 VADER (Valence Aware Dictionary and sEntiment Reasoner)
- Runs entirely in the browser (no API call)
- Returns a compound score from -1.0 (most negative) to +1.0 (most positive)
- Labels: positive (> 0.05), negative (< -0.05), neutral
- Fast and works offline

### 6.2 Hugging Face — distilroberta-base
- Called directly from the browser using the `VITE_HF_API_TOKEN`
- Model: `j-hartmann/emotion-english-distilroberta-base`
- Returns emotion labels (joy, anger, sadness, fear, disgust, surprise, neutral)
- Normalised to positive/negative/neutral for risk scoring
- Confidence threshold: results below 50% confidence are discounted

Both results are stored in `coach_feedback` and used together in the crime hotspot risk calculation, with cross-validation between the two models to reduce false positives.

---

## 7. Data Flow: Crime Hotspot Pipeline

```
Passenger submits feedback on /crowding
         ↓
VADER analysis (browser) + HF analysis (API)
         ↓
POST /api/coach-feedback → saved to Supabase coach_feedback
         ↓
GET /api/hotspot-data (public endpoint)
         ↓
Backend expands each feedback row to all intermediate
stops along the train route using LINE_STOPS lookup
         ↓
Frontend aggregates per-station:
 - Average VADER compound score
 - Negative feedback percentage
 - Incident count from safety_incidents table
         ↓
Risk score = (VADER weight × 0.4) + (neg% × 0.3) + (incidents × 0.3)
         ↓
Risk level assigned: High Risk / Moderate / Safe
         ↓
Displayed on /crime-map (cards) and /map (Google Maps markers)
```

---

## 8. Data Flow: Train Update → Email Notifications

```
Admin posts train update via /admin panel
         ↓
POST /api/admin/update (authenticated)
         ↓
Saved to Supabase train_updates table
         ↓
Backend queries Supabase subscriptions for all
users subscribed to the affected station
         ↓
EmailJS sends notification email to each subscriber
using EMAILJS_TEMPLATE_ID template
         ↓
Response returns: notified count, failed count
         ↓
Update appears on home page announcements panel
(auto-refreshes every 5 minutes)
```

---

## 9. API Reference

All endpoints are prefixed with `/api/`. Admin endpoints require the `x-admin-token` header.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/schedules` | Public | All train schedules |
| GET | `/api/alerts` | Public | Active service alerts |
| GET | `/api/news` | Public | Latest news items |
| GET | `/api/live-trains` | Public | Live scraped train data |
| GET | `/api/health` | Public | Service health check |
| POST | `/api/register` | Public | Register a new user |
| POST | `/api/subscribe` | Public | Subscribe to station alerts |
| POST | `/api/lost-found` | Public | Submit a lost item report |
| GET | `/api/lost-found` | Public | View all open lost item reports |
| POST | `/api/safety` | Public | Submit a safety incident report |
| POST | `/api/tickets` | Public | Generate a ticket |
| GET | `/api/tickets/:userId` | Public | Get ticket history |
| POST | `/api/chatbot` | Public | Send a chatbot message |
| POST | `/api/sentiment` | Public | Analyse sentiment from text |
| POST | `/api/coach-feedback` | Public | Submit coach feedback |
| GET | `/api/hotspot-data` | Public | Aggregated crime hotspot data |
| POST | `/api/admin/login` | Public | Admin login |
| GET | `/api/admin/stats` | Admin | Dashboard statistics |
| GET | `/api/admin/lost-found` | Admin | All lost & found reports |
| PATCH | `/api/admin/lost-found/:id` | Admin | Update lost item status |
| GET | `/api/admin/safety` | Admin | All safety incident reports |
| PATCH | `/api/admin/safety/:id` | Admin | Update safety incident status |
| POST | `/api/admin/update` | Admin | Post train status update + notify subscribers |
| GET | `/api/admin/subscribers` | Admin | All registered subscribers |
| GET | `/api/admin/update` | Admin | Recent train updates |
| POST/PUT/DELETE | `/api/admin/schedules` | Admin | Manage schedules |
| POST/PUT/DELETE | `/api/admin/alerts` | Admin | Manage alerts |
| POST/PUT/DELETE | `/api/admin/news` | Admin | Manage news |
| GET | `/api/coach-feedback` | Admin | All coach feedback submissions |

---

## 10. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | Dev only | Express server port (default 3001) |
| `VITE_API_URL` | Dev only | Frontend → backend URL |
| `ADMIN_USER` | Yes | Admin panel username |
| `ADMIN_PASS` | Yes | Admin panel password |
| `ADMIN_JWT_SECRET` | Yes | Secret for signing admin tokens |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service role key |
| `EMAILJS_SERVICE_ID` | Yes | EmailJS service ID |
| `EMAILJS_TEMPLATE_ID` | Yes | Template for train update notifications |
| `EMAILJS_FOUND_TEMPLATE_ID` | Yes | Template for lost item found notifications |
| `EMAILJS_PUBLIC_KEY` | Yes | EmailJS public key |
| `EMAILJS_PRIVATE_KEY` | Yes | EmailJS private key |
| `VITE_GOOGLE_MAPS_API_KEY` | Yes | Google Maps JavaScript API key |
| `VITE_HF_API_TOKEN` | Optional | Hugging Face token for sentiment analysis |
| `OPENAI_API_KEY` | Optional | OpenAI key for AI chatbot |
| `SERPAPI_KEY` | Optional | SerpAPI key for news scraping |

---

## 11. Project Structure

```
prasa-smart-connect/
├── netlify/
│   └── functions/
│       └── api.ts              # Full Express app as Netlify serverless function
├── server/
│   ├── routes/
│   │   ├── adminUpdate.ts      # Train updates + EmailJS subscriber notifications
│   │   ├── chatbot.ts          # OpenAI / rule-based chatbot
│   │   ├── lostFound.ts        # Lost & found public endpoints
│   │   ├── register.ts         # User registration
│   │   ├── safety.ts           # Safety incident reporting
│   │   ├── sentiment.ts        # VADER + HuggingFace sentiment
│   │   ├── stationSearch.ts    # Station search via Google Places
│   │   ├── subscribe.ts        # Station alert subscriptions
│   │   └── tickets.ts          # Ticket generation and history
│   ├── db.ts                   # Supabase client
│   ├── index.ts                # Local development Express server
│   ├── mailer.ts               # EmailJS email sending
│   ├── scraper.ts              # cttrains.co.za live data scraper
│   └── validate.ts             # Zod validation schemas
├── src/
│   ├── components/
│   │   ├── Header.tsx          # Navigation with language switcher
│   │   ├── Footer.tsx          # Site footer
│   │   ├── Chatbot.tsx         # Floating AI chatbot widget
│   │   ├── AlertsBanner.tsx    # Dismissible alerts banner
│   │   ├── RouteSearchForm.tsx # Reusable station-to-station search form
│   │   ├── TrainCard.tsx       # Train schedule display card
│   │   └── ShareJourney.tsx    # Journey sharing component
│   ├── data/
│   │   ├── prasa.ts            # Stations, coordinates, schedules, alerts
│   │   └── extras.ts           # Trip planner, crowding engine, fare calc
│   ├── lib/
│   │   ├── api.ts              # All frontend fetch calls
│   │   ├── i18n.ts             # 5-language translation system
│   │   ├── mapStyles.ts        # Google Maps custom style config
│   │   ├── ticketPDF.ts        # PDF ticket generation
│   │   ├── utils.ts            # Utility functions
│   │   └── vader.ts            # VADER sentiment analysis (in-browser)
│   └── routes/
│       ├── index.tsx           # Home page
│       ├── search.tsx          # Trip search
│       ├── planner.tsx         # Trip planner
│       ├── tracking.tsx        # Live train tracking
│       ├── alerts.tsx          # Service alerts
│       ├── map.tsx             # Interactive Google Map
│       ├── fares.tsx           # Fare calculator + e-ticket
│       ├── crowding.tsx        # Crowding predictor + feedback
│       ├── crime-map.tsx       # Crime hotspot detection
│       ├── lost-found.tsx      # Lost & found
│       ├── safety.tsx          # Safety & SOS
│       ├── register.tsx        # Alert registration
│       ├── tickets.tsx         # Ticket history
│       ├── news.tsx            # News feed
│       ├── tourist.tsx         # Tourist mode
│       ├── saved.tsx           # Saved routes
│       └── admin/
│           ├── index.tsx       # Admin dashboard
│           └── login.tsx       # Admin login
├── supabase_migration.sql      # Full database schema
├── netlify.toml                # Build config + API redirect rules
├── vite.config.ts              # Vite build configuration
└── package.json
```

---

## 12. Known Limitations

1. **Live tracking is simulated** — the system does not receive real GPS data from trains. Positions are calculated by advancing through the stops list on a timer.
2. **Scraper dependency** — live train data depends on cttrains.co.za remaining accessible. If the site changes structure, the scraper may break.
3. **Hotspot data requires submissions** — the crime hotspot map is only as accurate as the volume of passenger feedback submitted. With few submissions, most stations default to Safe.
4. **Email delivery** — EmailJS free tier has a monthly send limit. High subscriber volumes may require an upgrade.
5. **OpenAI chatbot** — if `OPENAI_API_KEY` is not set, the chatbot falls back to a rule-based system that only handles pre-defined topics.
6. **Schedule data is seeded** — the 54 train schedules in `prasa.ts` are representative but not scraped live from PRASA. Admin can override via the Admin Panel.

---

*Built for PRASA Metrorail Western Cape commuters.*

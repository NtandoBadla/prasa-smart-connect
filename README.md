<<<<<<< HEAD
# PRASA Smart Connect

A smart commuter web application for PRASA Metrorail passengers in the Western Cape, South Africa. The platform provides real-time train tracking, trip planning, service alerts, lost & found reporting, safety incident reporting, and an AI-powered chatbot — all in one place.

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
- [Deployment](#deployment)
- [API Overview](#api-overview)
- [Admin Panel](#admin-panel)

---

## About the Project

PRASA Smart Connect is a full-stack web application built to improve the daily commuting experience for Metrorail passengers in Cape Town. It aggregates live train status data, provides journey planning tools, enables passengers to report lost items and safety incidents, and allows admins to push real-time service updates with automatic email notifications to subscribers.

The application is deployed on **Netlify** with a **Supabase** PostgreSQL backend and uses **EmailJS** for transactional email delivery.

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
| Lost & Found | `/lost-found` | Report lost items and receive email notification when found |
| Safety Reports | `/safety` | Report safety incidents at stations |
| My Tickets | `/tickets` | View generated ticket history |
| Register | `/register` | Subscribe to station-specific email alerts |
| Admin Panel | `/admin` | Full admin dashboard (protected) |

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
| Supabase (PostgreSQL) | Primary database — users, subscriptions, tickets, lost & found, safety incidents, coach feedback, scraped trains |
| EmailJS | Transactional email — subscriber alerts, lost & found notifications, train update notifications |
| Hugging Face Inference API | Sentiment analysis for coach feedback (distilroberta-base) |
| OpenAI API | AI chatbot responses (optional, falls back to rule-based) |
| SerpAPI | News scraping (optional) |

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
│       └── api.ts          # Serverless Express app (production backend)
├── server/
│   ├── routes/
│   │   ├── adminUpdate.ts  # Train status updates + subscriber notifications
│   │   ├── chatbot.ts      # AI chatbot endpoint
│   │   ├── lostFound.ts    # Lost & found public endpoints
│   │   ├── register.ts     # User registration
│   │   ├── safety.ts       # Safety incident reporting
│   │   ├── sentiment.ts    # VADER + HuggingFace sentiment analysis
│   │   ├── stationSearch.ts# Station search (OpenStreetMap)
│   │   ├── subscribe.ts    # Station alert subscriptions
│   │   └── tickets.ts      # Ticket generation and history
│   ├── db.ts               # Supabase client
│   ├── index.ts            # Local development Express server
│   ├── mailer.ts           # EmailJS email sending functions
│   ├── scraper.ts          # cttrains.co.za live train scraper
│   └── validate.ts         # Zod validation schemas
├── src/
│   ├── components/         # Shared UI components (Header, Footer, Chatbot, etc.)
│   ├── data/
│   │   ├── prasa.ts        # Station data, schedule seeds, line definitions
│   │   └── extras.ts       # News types, trip planner logic
│   ├── hooks/              # Custom React hooks
│   ├── lib/
│   │   ├── api.ts          # Frontend API client (all fetch calls)
│   │   └── utils.ts        # Utility functions
│   ├── routes/
│   │   ├── admin/          # Admin dashboard and login
│   │   └── *.tsx           # All page routes
│   └── main.tsx            # React entry point
├── .env                    # Local environment variables (not committed)
├── .env.example            # Environment variable template
├── netlify.toml            # Netlify build and redirect configuration
├── supabase_migration.sql  # Database schema
├── package.json
├── tsconfig.json           # Frontend TypeScript config
├── tsconfig.server.json    # Backend TypeScript config
└── vite.config.ts          # Vite build configuration
```

---

## Prerequisites

- **Node.js** v20 or higher
- **npm** v9 or higher
- A **Supabase** project — [supabase.com](https://supabase.com)
- An **EmailJS** account — [emailjs.com](https://emailjs.com)

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

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

See the [Environment Variables](#environment-variables) section below for details on each variable.

### 4. Set up the database

Run the SQL in `supabase_migration.sql` inside your Supabase project:

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Paste the contents of `supabase_migration.sql` and click **Run**

This creates the following tables:
- `users` — registered subscribers
- `subscriptions` — station alert subscriptions
- `train_updates` — admin-posted train status updates
- `tickets` — generated passenger tickets
- `lost_found` — lost item reports
- `safety_incidents` — safety reports from passengers
- `coach_feedback` — crowding and sentiment submissions
- `scraped_trains` — live train data from the scraper
- `scraped_notices` — live service notices from the scraper
- `station_cache` — cached station search results

### 5. Test your connections

```bash
npm run test:connections
```

---

## Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Server port
PORT=3001

# Frontend → Backend URL (used by Vite during development)
VITE_API_URL=http://localhost:3001

# Admin credentials for the /admin panel
ADMIN_USER=admin
ADMIN_PASS=your-admin-password
ADMIN_JWT_SECRET=a-long-random-secret-string

# Supabase — get from: supabase.com → Project Settings → API
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# EmailJS — get from: emailjs.com → Account → API Keys
EMAILJS_SERVICE_ID=service_xxxxxxx
EMAILJS_TEMPLATE_ID=template_xxxxxxx       # General notifications / lost item confirmation
EMAILJS_FOUND_TEMPLATE_ID=template_xxxxxxx # "Item found" notification to passenger
EMAILJS_PUBLIC_KEY=your-public-key
EMAILJS_PRIVATE_KEY=your-private-key

# OpenAI — optional, chatbot falls back to rule-based if not set
# Get from: platform.openai.com/api-keys
OPENAI_API_KEY=sk-...

# Hugging Face — optional, sentiment falls back to VADER if not set
# Get from: huggingface.co/settings/tokens
VITE_HF_API_TOKEN=hf_...

# SerpAPI — optional, used for news scraping
# Get from: serpapi.com/manage-api-key
SERPAPI_KEY=your-serpapi-key
```

> For **Netlify deployment**, add all these variables in:
> Netlify Dashboard → Site configuration → Environment variables

---

## Running the App

The app requires two processes running simultaneously in development — the Vite frontend and the Express backend.

**Terminal 1 — Backend API server:**

```bash
npm run server
```

The API will be available at `http://localhost:3001`

**Terminal 2 — Frontend dev server:**

```bash
npm run dev
```

The app will be available at `http://localhost:8080`

### Other scripts

```bash
npm run build          # Production build
npm run preview        # Preview the production build locally
npm run lint           # Run ESLint
npm run format         # Format code with Prettier
npm run test:connections  # Test all external service connections
```

---

## Deployment

The project is configured for **Netlify** deployment out of the box.

### Steps

1. Push your code to a GitHub repository
2. Connect the repository to Netlify
3. Netlify will auto-detect the build settings from `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist/client`
   - Functions directory: `netlify/functions`
4. Add all environment variables in the Netlify dashboard
5. Deploy

All `/api/*` requests are automatically proxied to the Netlify serverless function via the redirect rule in `netlify.toml`.

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
| POST | `/api/admin/login` | Public | Admin login |
| GET | `/api/admin/stats` | Admin | Dashboard statistics |
| GET | `/api/admin/lost-found` | Admin | All lost & found reports |
| PATCH | `/api/admin/lost-found/:id` | Admin | Update lost item status (triggers email) |
| GET | `/api/admin/safety` | Admin | All safety incident reports |
| PATCH | `/api/admin/safety/:id` | Admin | Update safety incident status |
| POST | `/api/admin/update` | Admin | Post a train status update + notify subscribers |
| GET | `/api/admin/subscribers` | Admin | All registered subscribers |
| GET | `/api/health` | Public | Service health check |

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
- **Train Update** — push live status updates with automatic subscriber email notifications
- **Subscribers** — view all registered users
- **Safety Reports** — review and resolve safety incidents
- **Timetable** — add upcoming trains to the database timetable
- **Coach Feedback** — view passenger sentiment analysis by coach
- **Lost & Found** — manage lost item reports and mark items as found (triggers email to passenger)

---

Built for PRASA Metrorail Western Cape commuters.
=======
🚆 PRASA Smart Connect

A smart commuter platform designed for Passenger Rail Agency of South Africa Metrorail passengers in the Western Cape, South Africa.

PRASA Smart Connect provides:

Real-time train tracking
Smart trip planning
Service alerts
AI-powered chatbot assistance
Lost & Found management
Safety incident reporting
Ticket generation and history
Crowd and sentiment analysis

All within a single modern web application.

📚 Table of Contents
About the Project
Features
Tech Stack
Project Structure
Prerequisites
Getting Started
Environment Variables
Running the Application
Deployment
API Overview
Admin Dashboard
📖 About the Project

PRASA Smart Connect is a full-stack train assistance platform developed to improve the daily commuting experience for Cape Town Metrorail passengers.

The system aggregates:

live train schedules
service disruptions
station information
passenger feedback
AI-generated travel assistance

The application also enables:

automated email notifications
lost item management
safety reporting
smart crowd prediction

The platform is hosted on Netlify
 with a Supabase
 PostgreSQL backend and uses EmailJS
 for transactional email notifications.

✨ Features
Feature	Route	Description
Home	/	Landing page with train network overview
Trip Search	/search	Search trains between stations and generate tickets
Trip Planner	/planner	Multi-route journey planning
Live Tracking	/tracking	Simulated real-time train tracking
Service Alerts	/alerts	Real-time train disruption updates
Interactive Map	/map	Live station and route visualization
News	/news	Latest PRASA-related news
Fares	/fares	Fare and pricing information
Crowding & Sentiment	/crowding	AI-powered crowd and safety analysis
Lost & Found	/lost-found	Report and track lost items
Safety Reports	/safety	Submit safety incidents
My Tickets	/tickets	View generated ticket history
Register	/register	Subscribe to station alerts
Admin Dashboard	/admin	Protected admin management panel
AI Chatbot	/chatbot	Intelligent train assistant
🛠 Tech Stack
Frontend
Technology	Purpose
React 19	Frontend framework
TypeScript	Type safety
Tailwind CSS	Styling
TanStack Router	Routing
TanStack Query	Data fetching
Radix UI	Accessible UI components
Leaflet + React Leaflet	Interactive maps
Recharts	Data visualisation
Lucide React	Icons
Zod	Validation
Backend
Technology	Purpose
Express.js	REST API
Node.js	Backend runtime
TypeScript	Server-side type safety
node-cron	Scheduled scraping
Axios + Cheerio	Train data scraping
serverless-http	Netlify serverless support
Database & Integrations
Service	Purpose
Supabase
	PostgreSQL database
EmailJS
	Email notifications
Hugging Face
	Sentiment analysis
OpenAI API
	AI chatbot
SerpAPI
	News scraping
📂 Project Structure
prasa-smart-connect/
├── netlify/
├── server/
├── src/
├── .env
├── package.json
├── vite.config.ts
└── supabase_migration.sql
Main Backend Modules
chatbot.ts → AI chatbot
scraper.ts → CTTrains scraper
lostFound.ts → Lost & Found APIs
sentiment.ts → AI sentiment analysis
tickets.ts → Ticket generation
stationSearch.ts → Station search and maps
⚙️ Prerequisites

Before running the project, ensure you have:

Node.js v20+
npm v9+
A Supabase
 project
An EmailJS
 account
🚀 Getting Started
1. Clone the Repository
git clone https://github.com/your-username/prasa-smart-connect.git
cd prasa-smart-connect
2. Install Dependencies
npm install
3. Configure Environment Variables
cp .env.example .env

Add your API keys and configuration values.

4. Configure the Database

Run the supabase_migration.sql script inside your Supabase SQL Editor.

This creates tables for:

users
subscriptions
train updates
tickets
lost items
safety reports
sentiment analysis
scraped train data
5. Test External Services
npm run test:connections
🔐 Environment Variables
PORT=3001
VITE_API_URL=http://localhost:3001

SUPABASE_URL=
SUPABASE_SERVICE_KEY=

EMAILJS_SERVICE_ID=
EMAILJS_TEMPLATE_ID=
EMAILJS_PUBLIC_KEY=
EMAILJS_PRIVATE_KEY=

OPENAI_API_KEY=
VITE_HF_API_TOKEN=
SERPAPI_KEY=

For deployment, add these variables in the Netlify dashboard.

▶️ Running the Application
Backend
npm run server

Runs at:

http://localhost:3001
Frontend
npm run dev

Runs at:

http://localhost:8080
📦 Deployment

The project is configured for deployment on Netlify
.

Deployment Steps
Push the project to GitHub
Connect repository to Netlify
Configure environment variables
Deploy

The backend runs using Netlify Functions.

🔌 API Overview
Method	Endpoint	Description
GET	/api/schedules	Retrieve train schedules
GET	/api/alerts	Retrieve service alerts
POST	/api/register	Register a user
POST	/api/subscribe	Subscribe to alerts
POST	/api/chatbot	AI chatbot endpoint
POST	/api/lost-found	Report lost items
POST	/api/safety	Submit safety reports
POST	/api/tickets	Generate tickets
POST	/api/sentiment	Analyse sentiment
POST	/api/admin/update	Push train updates
🛡 Admin Dashboard

Access:

/admin/login

The dashboard allows administrators to:

manage schedules
post alerts
review safety reports
manage lost items
notify passengers
publish news
monitor sentiment analysis
manage subscribers
🤖 AI Features

The platform includes:

AI chatbot assistance
Crowd prediction
Safety analysis
Smart route recommendations
Sentiment analysis using:
Hugging Face
VADER
🌍 Vision

PRASA Smart Connect aims to modernize commuter rail experiences in South Africa by combining:

real-time transport data
AI-driven assistance
automation
modern web technologies

into one intelligent commuter platform.

Built for Cape Town Metrorail commuters.
>>>>>>> e72859b9c4146689b5355fd59884fdfa46b4df38

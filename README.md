# 🚆 PRASA Smart Connect

## Intelligent Rail Passenger Management & Safety Platform

PRASA Smart Connect is a modern digital commuter platform designed to improve the travel experience, passenger safety, and operational efficiency of PRASA Metrorail services in the Western Cape, South Africa.

The platform centralizes train information, journey planning, digital ticketing, safety reporting, lost and found services, crowd monitoring, and AI-powered customer assistance into a single intelligent ecosystem.

Built using React, TypeScript, Supabase, and modern cloud technologies, the system provides real-time communication between commuters, security personnel, and administrators while supporting automation, data-driven decision-making, and enhanced service delivery.

---

# Table of Contents

* Overview
* Problem Statement
* Objectives
* Key Features
* System Architecture
* Technology Stack
* Project Structure
* Installation Guide
* Environment Variables
* Database Architecture
* Automation & Workflows
* AI Chatbot
* Security & Ticket Validation
* API Documentation
* Admin Portal
* Deployment
* Future Enhancements
* Contributors
* License

---

# Overview

PRASA Smart Connect was developed to modernize commuter rail services by providing passengers with real-time information, intelligent support, and digital tools that improve convenience, safety, and communication.

The platform enables passengers to:

* View train schedules
* Track train movements
* Receive service alerts
* Report safety incidents
* Report lost items
* Purchase and manage digital tickets
* Receive email and SMS notifications
* Interact with an AI-powered chatbot

Administrators can monitor system activity, manage incidents, publish updates, and communicate with passengers in real time.

---

# Problem Statement

Rail commuters often face several challenges:

* Limited access to real-time train information
* Delayed communication during service disruptions
* Difficulty reporting incidents or lost items
* Lack of digital ticket management
* Limited visibility into crowding levels
* Poor passenger engagement channels

PRASA Smart Connect addresses these challenges through a centralized digital platform that improves communication, safety, and operational visibility.

---

# Objectives

The primary objectives of the project are:

* Improve commuter experience
* Increase passenger safety
* Modernize ticket management
* Provide real-time service updates
* Enhance communication between passengers and PRASA
* Automate operational workflows
* Enable data-driven decision-making

---

# Key Features

## Passenger Features

### Train Search

Search trains between stations and view available routes.

### Trip Planner

Plan journeys with transfer recommendations and route optimization.

### Live Train Tracking

View train locations and operational status in real time.

### Service Alerts

Receive updates regarding:

* Delays
* Cancellations
* Route disruptions
* Maintenance activities

### Digital Tickets

Generate and manage:

* Single journey tickets
* Return tickets
* Multi-ride tickets

### Lost & Found

Passengers can:

* Report lost items
* Track report status
* Receive notifications when items are recovered

### Safety Reporting

Passengers can report:

* Security incidents
* Suspicious activities
* Infrastructure issues
* Emergencies

### AI Chatbot

Provides assistance for:

* Timetables
* Routes
* Train information
* Ticket information
* Station information
* Service updates

### Crowding Predictor

Uses passenger feedback and sentiment analysis to estimate:

* Crowd density
* Passenger comfort
* Safety levels

### Interactive Map

Displays:

* Stations
* Routes
* Train lines
* Service coverage

---

# System Architecture

```text
Passengers
      │
      ▼
React + TypeScript Frontend
      │
      ▼
Express REST API
      │
      ▼
Supabase PostgreSQL Database
      │
 ┌────┼────┐
 ▼    ▼    ▼
Chatbot Alerts Tickets
 │    │      │
 ▼    ▼      ▼
EmailJS SMSPortal Realtime
      │
      ▼
Passengers
```

---

# Technology Stack

## Frontend

* React 19
* TypeScript
* TanStack Router
* TanStack Query
* Tailwind CSS
* Radix UI
* Recharts
* React Leaflet
* Lucide React

## Backend

* Express.js
* TypeScript
* Axios
* Cheerio
* Node Cron
* Serverless HTTP

## Database

* Supabase PostgreSQL
* Supabase Realtime
* Supabase Edge Functions

## AI & Analytics

* OpenAI API
* Hugging Face
* VADER Sentiment Analysis

## Communication

* EmailJS
* SMSPortal

## Payments

* Stripe

## Deployment

* Netlify
* Vite

---

# Project Structure

```text
prasa-smart-connect/

├── src/
│   ├── components/
│   ├── routes/
│   ├── hooks/
│   ├── data/
│   └── lib/
│
├── server/
│   ├── routes/
│   ├── middleware/
│   ├── scraper/
│   ├── db/
│   └── automation/
│
├── supabase/
│   ├── migrations/
│   └── functions/
│
├── netlify/
│   └── functions/
│
└── scripts/
```

---

# Installation Guide

## Clone Repository

```bash
git clone https://github.com/yourusername/prasa-smart-connect.git
cd prasa-smart-connect
```

## Install Dependencies

```bash
npm install
```

## Configure Environment Variables

```bash
cp .env.example .env
```

## Run Database Migrations

Execute:

```sql
supabase_migration.sql
```

and

```sql
automation.sql
```

inside Supabase SQL Editor.

---

# Environment Variables

```env
PORT=3001

VITE_API_URL=http://localhost:3001

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

EMAILJS_SERVICE_ID=
EMAILJS_TEMPLATE_ID=
EMAILJS_FOUND_TEMPLATE_ID=
EMAILJS_PUBLIC_KEY=
EMAILJS_PRIVATE_KEY=

SMSPORTAL_CLIENT_ID=
SMSPORTAL_CLIENT_SECRET=

OPENAI_API_KEY=

VITE_HF_API_TOKEN=

STRIPE_SECRET_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=
```

---

# Database Architecture

## Core Tables

| Table            | Purpose                |
| ---------------- | ---------------------- |
| users            | Registered users       |
| subscriptions    | Alert subscriptions    |
| tickets          | Digital tickets        |
| ticket_scans     | Ticket validation logs |
| lost_found       | Lost item reports      |
| safety_incidents | Passenger reports      |
| coach_feedback   | Crowding feedback      |
| train_updates    | Admin updates          |
| scraped_trains   | Live train information |
| scraped_notices  | Service notices        |
| prasa_routes     | Route definitions      |
| prasa_stations   | Station definitions    |
| prasa_timetable  | Train timetable data   |

---

# Automation & Workflows

The system uses automation to reduce manual work.

## Automated Alerts

When train delays or disruptions are detected:

1. Data is scraped
2. Supabase stores updates
3. Webhooks trigger Edge Functions
4. Notifications are sent

## Lost & Found Automation

When an item is marked as found:

1. Admin updates status
2. Trigger executes
3. Email notification sent
4. SMS notification sent

## Ticket Expiry Automation

Expired tickets are automatically updated.

## Daily Reports

Automated reports provide:

* Tickets sold
* Tickets scanned
* Safety incidents
* Delays
* Lost & found statistics
* Crowding trends

---

# AI Chatbot

The chatbot provides intelligent responses based on:

* Timetable data
* Route information
* Service alerts
* Station information
* Lost & Found procedures
* Ticket information

The chatbot can operate using:

* Rule-based responses
* OpenAI-powered responses
* Supabase knowledge base

---

# Security & Ticket Validation

## Digital Ticket Validation

Each ticket contains a unique QR Code.

Security personnel can:

* Scan tickets
* Verify authenticity
* Check expiry dates
* View remaining rides
* Detect duplicate usage

## Security Portal

Security officers have access to:

* Ticket scanner
* Validation dashboard
* Incident reports
* Passenger verification tools

## Safety Features

* Emergency reporting
* SOS functionality
* Security incident logging
* Location-based alerts

---

# API Documentation

Base URL

```text
/api
```

## Public Endpoints

| Method | Endpoint        |
| ------ | --------------- |
| GET    | /api/schedules  |
| GET    | /api/alerts     |
| GET    | /api/news       |
| POST   | /api/register   |
| POST   | /api/subscribe  |
| POST   | /api/lost-found |
| POST   | /api/safety     |
| POST   | /api/tickets    |
| POST   | /api/chatbot    |

## Admin Endpoints

| Method | Endpoint               |
| ------ | ---------------------- |
| POST   | /api/admin/login       |
| GET    | /api/admin/stats       |
| GET    | /api/admin/subscribers |
| GET    | /api/admin/lost-found  |
| GET    | /api/admin/safety      |
| POST   | /api/admin/update      |

---

# Admin Portal

Administrators can manage:

* Train schedules
* Service alerts
* Passenger reports
* Lost & Found requests
* Subscriber management
* News publishing
* Ticket monitoring
* Crowding analytics

---

# Deployment

## Netlify

```bash
npm run build
```

Deploy to Netlify and configure:

* Environment Variables
* Redirect Rules
* Serverless Functions

---

# Future Enhancements

* Real GPS train tracking
* WhatsApp notifications
* Mobile application
* Predictive delay analysis
* Facial recognition for station security
* Smart crowd management
* Offline ticket validation
* AI-powered route recommendations
* Passenger reward system
* Multi-language support

---

# Contributors

### Development Team

* Ntando Badla – Full Stack Development, Database Design, Automation & System Architecture
* Semoshwe – Sentiment Analysis & Crowding Prediction
* Anita – AI Chatbot Development

---

# License

This project was developed for educational, innovation, and railway digital transformation purposes.

© 2026 PRASA Smart Connect. All Rights Reserved.

/**
 * scheduled-notify.ts
 *
 * Netlify Scheduled Function — runs every 10 minutes.
 * Calls the /api/auto-notify endpoint on the same deployment,
 * which triggers a fresh scrape and sends email/SMS to subscribers
 * of any delayed or cancelled trains.
 *
 * Schedule: every 10 minutes  →  "*/10 * * * *"
 *
 * Netlify docs: https://docs.netlify.com/functions/scheduled-functions/
 */

import type { Config, Context } from "@netlify/functions";

export default async function handler(_req: Request, _ctx: Context) {
  const baseUrl = process.env.URL ?? process.env.DEPLOY_URL;
  const secret  = process.env.NOTIFY_SECRET;

  if (!baseUrl) {
    console.error("[scheduled-notify] URL env var not set — cannot call auto-notify.");
    return new Response("URL not configured", { status: 500 });
  }

  if (!secret) {
    console.error("[scheduled-notify] NOTIFY_SECRET env var not set.");
    return new Response("NOTIFY_SECRET not configured", { status: 500 });
  }

  const endpoint = `${baseUrl.replace(/\/$/, "")}/.netlify/functions/api/auto-notify`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-notify-secret": secret,
      },
    });

    const body = await res.json().catch(() => ({}));
    console.log(`[scheduled-notify] Response ${res.status}:`, body);

    return new Response(JSON.stringify(body), {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[scheduled-notify] Fetch failed:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export const config: Config = {
  schedule: "*/10 * * * *",
};

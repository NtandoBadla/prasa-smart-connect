const BASE = (import.meta.env.PROD ? "" : (import.meta.env.VITE_API_URL ?? "")) + "/api";

function getToken() {
  return localStorage.getItem("admin_token") ?? "";
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": getToken(),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    // Auto-clear stale token and redirect to login on 401
    if (res.status === 401) {
      localStorage.removeItem("admin_token");
      if (window.location.pathname.startsWith("/admin") && !window.location.pathname.includes("/login")) {
        window.location.href = "/admin/login";
      }
    }
    throw new Error(body?.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // ── Health ──────────────────────────────────────────────────────────────────
  health: () =>
    apiFetch<{ status: string; supabase: string; emailjs: string; serpapi: string; openai: string }>("/health"),

  // ── Public ──────────────────────────────────────────────────────────────────
  schedules: () => apiFetch<import("@/data/prasa").TrainSchedule[]>("/schedules"),
  alerts: () => apiFetch<import("@/data/prasa").ServiceAlert[]>("/alerts"),
  news: () => apiFetch<import("@/data/extras").NewsItem[]>("/news"),

  // ── Auth ────────────────────────────────────────────────────────────────────
  login: (username: string, password: string) =>
    apiFetch<{ token: string }>("/admin/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => apiFetch("/admin/logout", { method: "POST" }),

  // ── Registration & subscriptions ────────────────────────────────────────────
  register: (email: string, station: string) =>
    apiFetch<{ message: string; userId: string }>("/register", {
      method: "POST",
      body: JSON.stringify({ email, station }),
    }),
  subscribe: (email: string, station: string) =>
    apiFetch<{ message: string }>("/subscribe", {
      method: "POST",
      body: JSON.stringify({ email, station }),
    }),
  getSubscriptions: (email: string) =>
    apiFetch<{ station: string; created_at: string }[]>(
      `/subscribe/${encodeURIComponent(email)}`,
    ),

  // ── Chatbot ─────────────────────────────────────────────────────────────────
  chat: (message: string) =>
    apiFetch<{ reply: string }>("/chatbot", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),

  // ── Admin ───────────────────────────────────────────────────────────────────
  stats: () =>
    apiFetch<{
      totalSchedules: number;
      onTime: number;
      delayed: number;
      cancelled: number;
      totalAlerts: number;
      criticalAlerts: number;
      totalNews: number;
      totalSubscribers: number;
    }>("/admin/stats"),

  subscribers: () =>
    apiFetch<{ id: string; email: string; station: string; created_at: string }[]>(
      "/admin/subscribers",
    ),

  trainUpdate: (data: {
    trainNo: string;
    line: string;
    station: string;
    status: string;
    delayMin?: number;
    reason?: string;
  }) =>
    apiFetch<{ message: string; notified: number; failed: number }>(
      "/admin/update",
      { method: "POST", body: JSON.stringify(data) },
    ),

  recentUpdates: () =>
    apiFetch<
      {
        id: string;
        train_no: string;
        line: string;
        station: string;
        status: string;
        delay_min: number;
        reason: string;
        updated_at: string;
      }[]
    >("/admin/update"),

  createAlert: (data: object) =>
    apiFetch("/admin/alerts", { method: "POST", body: JSON.stringify(data) }),
  updateAlert: (id: string, data: object) =>
    apiFetch(`/admin/alerts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteAlert: (id: string) =>
    apiFetch(`/admin/alerts/${id}`, { method: "DELETE" }),

  createSchedule: (data: object) =>
    apiFetch("/admin/schedules", { method: "POST", body: JSON.stringify(data) }),
  updateSchedule: (id: string, data: object) =>
    apiFetch(`/admin/schedules/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteSchedule: (id: string) =>
    apiFetch(`/admin/schedules/${id}`, { method: "DELETE" }),

  createNews: (data: object) =>
    apiFetch("/admin/news", { method: "POST", body: JSON.stringify(data) }),
  updateNews: (id: string, data: object) =>
    apiFetch(`/admin/news/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteNews: (id: string) =>
    apiFetch(`/admin/news/${id}`, { method: "DELETE" }),

  // ── Tickets ─────────────────────────────────────────────────────────────────
  generateTicket: (data: {
    userId?: string;
    trainNo: string;
    line: string;
    from: string;
    to: string;
    departure: string;
    arrival: string;
    fare: number;
    travelClass?: string;
  }) => apiFetch<{
    id: string;
    ticket_ref: string;
    train_no: string;
    line: string;
    from_station: string;
    to_station: string;
    departure: string;
    arrival: string;
    fare: number;
    travel_class: string;
    booked_at: string;
  }>("/tickets", { method: "POST", body: JSON.stringify(data) }),

  ticketHistory: (userId: string) =>
    apiFetch<{
      id: string;
      ticket_ref: string;
      train_no: string;
      line: string;
      from_station: string;
      to_station: string;
      departure: string;
      arrival: string;
      fare: number;
      travel_class: string;
      booked_at: string;
    }[]>(`/tickets/${encodeURIComponent(userId)}`),

  timetable: () =>
    apiFetch<Record<string, unknown>[]>("/tickets/timetable"),

  addTimetableEntry: (data: object) =>
    apiFetch<Record<string, unknown>>("/tickets/timetable", { method: "POST", body: JSON.stringify(data) }),

  // ── Coach Feedback ──────────────────────────────────────────────────────────
  coachFeedback: () =>
    apiFetch<{
      id: string; train_no: string; line: string; from_station: string; to_station: string;
      coach: number; feedback_text: string; hf_label: string; hf_confidence: number;
      vader_label: string; vader_compound: number; travel_time: string; submitted_at: string;
    }[]>("/coach-feedback"),

  // ── Sentiment ────────────────────────────────────────────────────────────────
  analyzeSentiment: (texts: string[]) =>
    apiFetch<{
      crowdLevel: "Low" | "Medium" | "High";
      safetyRating: "Safe" | "Moderate" | "Risky";
      sentimentScore: number;
      compound: number;
      crowdScore: number;
      safetyScore: number;
      huggingFace: { label: string; score: number } | null;
      analyzedCount: number;
    }>("/sentiment", { method: "POST", body: JSON.stringify({ texts }) }),

  // ── Lost & Found ────────────────────────────────────────────────────────────
  getLostFound: () =>
    apiFetch<{
      id: string;
      item: string;
      station: string;
      date: string;
      contact_ref: string;
      status: "open" | "matched";
      created_at: string;
    }[]>("/lost-found"),

  reportLostFound: (data: { item: string; station: string; date: string; contact: string }) =>
    apiFetch<{
      id: string;
      item: string;
      station: string;
      date: string;
      contact_ref: string;
      status: "open" | "matched";
      created_at: string;
    }>("/lost-found", { method: "POST", body: JSON.stringify(data) }),

  // ── Admin: Lost & Found ─────────────────────────────────────────────────────
  adminLostFound: () =>
    apiFetch<{
      id: string;
      item: string;
      station: string;
      date: string;
      contact: string;
      contact_ref: string;
      status: "open" | "matched";
      created_at: string;
    }[]>("/admin/lost-found"),

  updateLostFoundStatus: (id: string, status: "open" | "matched") =>
    apiFetch<{
      id: string;
      item: string;
      station: string;
      date: string;
      contact: string;
      contact_ref: string;
      status: "open" | "matched";
      created_at: string;
    }>(`/admin/lost-found/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  // ── Station Search (Google Places → Supabase cache) ───────────────────────
  searchStations: (q: string) =>
    apiFetch<{
      results: {
        name: string;
        place_id: string;
        address: string;
        lat: number;
        lng: number;
        open_now: boolean | null;
        rating: number | null;
        status: string;
      }[];
      source: "cache" | "google";
    }>(`/stations/search?q=${encodeURIComponent(q)}`),

  stationDetails: (placeId: string) =>
    apiFetch<{
      name: string;
      formatted_address: string;
      opening_hours: { open_now: boolean; weekday_text: string[] } | null;
      rating: number | null;
      formatted_phone_number: string | null;
      geometry: { location: { lat: number; lng: number } };
    }>(`/stations/details/${placeId}`),

  // ── Live Trains (scraped) ────────────────────────────────────────────────────
  liveTrains: () =>
    apiFetch<{
      train_no: string;
      from_station: string;
      to_station: string;
      departure: string;
      arrival: string;
      status: string;
      line: string;
      delay_min: number;
      reason: string;
      scraped_at: string;
    }[]>("/live-trains"),

  reportSafetyIncident: (data: { type: string; station: string; details: string }) =>
    apiFetch<{
      id: string;
      type: string;
      station: string;
      details: string;
      status: string;
      created_at: string;
    }>("/safety", { method: "POST", body: JSON.stringify(data) }),

  // ── Admin: Safety incidents ─────────────────────────────────────────────────────
  adminSafetyIncidents: () =>
    apiFetch<{
      id: string;
      type: string;
      station: string;
      details: string;
      status: string;
      created_at: string;
    }[]>("/admin/safety"),

  updateSafetyStatus: (id: string, status: string) =>
    apiFetch<{ id: string; status: string }>(`/admin/safety/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
};

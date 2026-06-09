const BASE = (import.meta.env.PROD ? "" : (import.meta.env.VITE_API_URL ?? "")) + "/api";

export interface AdminTicket {
  id: string;
  ticket_ref: string;
  qr_token: string;
  user_id: string | null;
  passenger_name: string | null;
  id_number: string | null;
  phone: string | null;
  email: string | null;
  train_no: string;
  line: string;
  from_station: string;
  to_station: string;
  departure: string;
  arrival: string | null;
  fare: number;
  travel_class: string;
  payment_intent_id: string | null;
  payment_status: "pending" | "paid" | "failed";
  used: boolean;
  used_at: string | null;
  booked_at: string;
}

export interface TimetableResult {
  train_no: string;
  route_id: string;
  from_station: string;
  to_station: string;
  departure: string;
  arrival: string;
  duration_min: number;
}

export interface TimetableStop {
  train_no: string;
  route_id: string;
  station_name: string;
  stop_order: number;
  departure: string | null;
}

export interface PrasaRoute {
  id: string;
  line_name: string;
  direction: string;
  from_station: string;
  to_station: string;
  days_of_operation: string;
}

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
  register: (email: string, station: string, phone?: string) =>
    apiFetch<{ message: string; userId: string }>("/register", {
      method: "POST",
      body: JSON.stringify({ email, station, ...(phone ? { phone } : {}) }),
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
  createPaymentIntent: (data: {
    userId?: string;
    trainNo: string;
    line: string;
    from: string;
    to: string;
    departure: string;
    arrival: string;
    fare: number;
    travelClass?: string;
    passengerName?: string;
    idNumber?: string;
    phone?: string;
    email?: string;
  }) => apiFetch<{ clientSecret: string; ticketId: string; ticketRef: string }>(
    "/tickets/create-payment-intent",
    { method: "POST", body: JSON.stringify(data) },
  ),

  confirmPayment: (paymentIntentId: string) =>
    apiFetch<{
      id: string; ticket_ref: string; qr_token: string;
      train_no: string; line: string; from_station: string; to_station: string;
      departure: string; arrival: string; fare: number; travel_class: string; booked_at: string;
    }>("/tickets/confirm-payment", {
      method: "POST",
      body: JSON.stringify({ paymentIntentId }),
    }),

  // kept for planner page backwards compat
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
    passengerName?: string;
    idNumber?: string;
    phone?: string;
    email?: string;
  }) => apiFetch<{
    id: string; ticket_ref: string; qr_token: string;
    train_no: string; line: string; from_station: string; to_station: string;
    departure: string; arrival: string; fare: number; travel_class: string; booked_at: string;
  }>("/tickets/generate", { method: "POST", body: JSON.stringify(data) }),

  ticketHistory: (userId: string) =>
    apiFetch<{
      id: string;
      ticket_ref: string;
      qr_token: string;
      train_no: string;
      line: string;
      from_station: string;
      to_station: string;
      departure: string;
      arrival: string;
      fare: number;
      travel_class: string;
      payment_status: string;
      used: boolean;
      used_at: string | null;
      booked_at: string;
    }[]>(`/tickets/${encodeURIComponent(userId)}`),

  timetable: () =>
    apiFetch<Record<string, unknown>[]>("/tickets/timetable"),

  addTimetableEntry: (data: object) =>
    apiFetch<Record<string, unknown>>("/tickets/timetable", { method: "POST", body: JSON.stringify(data) }),

  // ── Crime Hotspot (public — no auth) ───────────────────────────────────────────
  hotspotData: () =>
    apiFetch<{
      feedback: {
        from_station: string;
        to_station: string;
        vader_compound: number;
        vader_label: string;
        hf_label: string;
        hf_confidence: number;
        submitted_at: string;
      }[];
      incidents: {
        station: string;
        type: string;
        status: string;
        created_at: string;
      }[];
    }>("/hotspot-data"),

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

  announcements: () =>
    apiFetch<{
      notices: { title: string; body: string; line: string; scraped_at: string }[];
      adminUpdates: { id: string; train_no: string; line: string; station: string; status: string; delay_min: number; reason: string; updated_at: string }[];
    }>("/announcements"),

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

  // ── Admin: Ticket Recovery ──────────────────────────────────────────────────
  adminTickets: (params?: { q?: string; status?: string; line?: string }) => {
    const qs = new URLSearchParams();
    if (params?.q)      qs.set("q", params.q);
    if (params?.status) qs.set("status", params.status);
    if (params?.line)   qs.set("line", params.line);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<AdminTicket[]>(`/admin/tickets${query}`);
  },

  reissueTicket: (ticketId: string, channels: ("email" | "sms")[]) =>
    apiFetch<{ ticket_ref: string; results: { channel: string; status: string; error?: string }[] }>(
      "/admin/tickets/reissue",
      { method: "POST", body: JSON.stringify({ ticketId, channels }) },
    ),

  ticketRecoveryLog: () =>
    apiFetch<{ id: number; ticket_id: string; ticket_ref: string; action: string; note: string; created_at: string }[]>(
      "/admin/tickets/recovery-log",
    ),

  // ── Official PRASA Timetable ─────────────────────────────────────────────────
  timetableSearch: (from: string, to: string, time?: string) => {
    const q = new URLSearchParams({ from, to, ...(time ? { time } : {}) });
    return apiFetch<TimetableResult[]>(`/timetable/search?${q}`);
  },

  timetableTrain: (trainNo: string) =>
    apiFetch<TimetableStop[]>(`/timetable/train/${encodeURIComponent(trainNo)}`),

  timetableRoutes: () =>
    apiFetch<PrasaRoute[]>(`/timetable/routes`),

  timetableStations: (routeId: string) =>
    apiFetch<{ station_name: string; stop_order: number; lat: number; lng: number }[]>(
      `/timetable/stations/${encodeURIComponent(routeId)}`
    ),

  timetableNext: (station: string, direction?: string, limit = 5) => {
    const q = new URLSearchParams({ station, limit: String(limit), ...(direction ? { direction } : {}) });
    return apiFetch<TimetableStop[]>(`/timetable/next?${q}`);
  },

  // ── Admin: PRASA Timetable management ────────────────────────────────────────
  adminTimetableRoutes: () =>
    apiFetch<PrasaRoute[]>(`/timetable/routes`),

  adminTimetableByRoute: (routeId: string) =>
    apiFetch<(TimetableStop & { platform: string | null })[]>(`/timetable/train/by-route/${encodeURIComponent(routeId)}`),

  adminUpsertStop: (data: {
    route_id: string; train_no: string; station_name: string;
    stop_order: number; departure: string | null; platform?: string;
  }) => apiFetch<TimetableStop>(`/timetable/admin/stop`, { method: "POST", body: JSON.stringify(data) }),

  adminDeleteTrain: (trainNo: string) =>
    apiFetch<{ ok: boolean }>(`/timetable/admin/train/${encodeURIComponent(trainNo)}`, { method: "DELETE" }),
};

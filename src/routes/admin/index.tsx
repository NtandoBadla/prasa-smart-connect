import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { AdminTicket, PrasaRoute, TimetableStop } from "@/lib/api";
import type { TrainSchedule, ServiceAlert } from "@/data/prasa";
import type { NewsItem } from "@/data/extras";
import { STATIONS } from "@/data/prasa";
import {
  Train, AlertTriangle, Newspaper, LayoutDashboard,
  LogOut, Plus, Pencil, Trash2, Check, X, RefreshCw,
  Users, Send, Bell, ShieldAlert, CalendarClock, MessageSquare, PackageSearch, Ticket, Search, RotateCcw,
} from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

type Tab = "overview" | "schedules" | "alerts" | "news" | "subscribers" | "update" | "safety" | "timetable" | "coachfeedback" | "lostfound" | "tickets";

type Stats = {
  totalSchedules: number; onTime: number; delayed: number;
  cancelled: number; totalAlerts: number; criticalAlerts: number; totalNews: number;
  totalSubscribers: number;
};

type Subscriber = { id: string; email: string; station: string; created_at: string };
type TrainUpdateRecord = { id: string; train_no: string; line: string; station: string; status: string; delay_min: number; reason: string; updated_at: string };
type SafetyIncident = { id: string; type: string; station: string; details: string; status: string; created_at: string };
type LostFoundItem = { id: string; item: string; station: string; date: string; contact: string; contact_ref: string; status: "open" | "matched"; created_at: string };

function useAdminGuard() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!localStorage.getItem("admin_token")) navigate({ to: "/admin/login" });
  }, [navigate]);
}

function AdminDashboard() {
  useAdminGuard();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [schedules, setSchedules] = useState<TrainSchedule[]>([]);
  const [alerts, setAlerts] = useState<ServiceAlert[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [updates, setUpdates] = useState<TrainUpdateRecord[]>([]);
  const [safetyIncidents, setSafetyIncidents] = useState<SafetyIncident[]>([]);
  const [timetableEntries, setTimetableEntries] = useState<Record<string, unknown>[]>([]);
  const [coachFeedback, setCoachFeedback] = useState<any[]>([]);
  const [lostFoundItems, setLostFoundItems] = useState<LostFoundItem[]>([]);
  const [adminTickets, setAdminTickets] = useState<AdminTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, a, n, st] = await Promise.all([api.schedules(), api.alerts(), api.news(), api.stats()]);
      setSchedules(s); setAlerts(a); setNews(n); setStats(st);
      // Load in background — don't block if Supabase not configured
      api.subscribers().then(setSubscribers).catch(() => {});
      api.recentUpdates().then(setUpdates).catch(() => {});
      api.adminSafetyIncidents().then(setSafetyIncidents).catch(() => {});
      api.timetable().then(setTimetableEntries).catch(() => {});
      api.coachFeedback().then(setCoachFeedback).catch(() => {});
      api.adminLostFound().then(setLostFoundItems).catch(() => {});
      api.adminTickets().then(setAdminTickets).catch(() => {});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleLogout() {
    await api.logout().catch(() => {});
    localStorage.removeItem("admin_token");
    navigate({ to: "/admin/login" });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex items-center gap-2 border-b border-border px-4 py-4">
          <img src="/Train Logo.png" alt="PRASA Logo" className="h-10 w-10 object-contain" />
          <span className="font-bold text-foreground">PRASA Admin</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          <NavItem icon={<LayoutDashboard className="h-4 w-4" />} label="Overview" active={tab === "overview"} onClick={() => setTab("overview")} />
          <NavItem icon={<Train className="h-4 w-4" />} label="Schedules" active={tab === "schedules"} onClick={() => setTab("schedules")} />
          <NavItem icon={<AlertTriangle className="h-4 w-4" />} label="Alerts" active={tab === "alerts"} onClick={() => setTab("alerts")} />
          <NavItem icon={<Newspaper className="h-4 w-4" />} label="News" active={tab === "news"} onClick={() => setTab("news")} />
          <NavItem icon={<Bell className="h-4 w-4" />} label="Train Update" active={tab === "update"} onClick={() => setTab("update")} />
          <NavItem icon={<Users className="h-4 w-4" />} label="Subscribers" active={tab === "subscribers"} onClick={() => setTab("subscribers")} />
          <NavItemBadge
            icon={<ShieldAlert className="h-4 w-4" />}
            label="Safety Reports"
            active={tab === "safety"}
            onClick={() => setTab("safety")}
            count={safetyIncidents.filter((i) => i.status === "pending").length}
          />
          <NavItem icon={<CalendarClock className="h-4 w-4" />} label="Timetable" active={tab === "timetable"} onClick={() => setTab("timetable")} />
          <NavItemBadge
            icon={<MessageSquare className="h-4 w-4" />}
            label="Coach Feedback"
            active={tab === "coachfeedback"}
            onClick={() => setTab("coachfeedback")}
            count={coachFeedback.filter((f) => f.hf_label === "negative" || f.vader_compound < -0.2).length}
          />
          <NavItemBadge
            icon={<PackageSearch className="h-4 w-4" />}
            label="Lost & Found"
            active={tab === "lostfound"}
            onClick={() => setTab("lostfound")}
            count={lostFoundItems.filter((item) => item.status === "open").length}
          />
          <NavItem icon={<Ticket className="h-4 w-4" />} label="Ticket Recovery" active={tab === "tickets"} onClick={() => setTab("tickets")} />
        </nav>
        <div className="border-t border-border p-3 space-y-1">
          <Link to="/" className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-muted-foreground hover:bg-secondary">
            &larr; Public site
          </Link>
          <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-destructive hover:bg-destructive/10">
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
          <h1 className="font-semibold text-foreground capitalize">{tab}</h1>
          <button onClick={refresh} className="flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 text-xs hover:bg-secondary">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </header>

        <main className="flex-1 overflow-auto p-6">
          {tab === "overview" && stats && <OverviewTab stats={stats} schedules={schedules} alerts={alerts} />}
          {tab === "schedules" && <SchedulesTab schedules={schedules} onRefresh={refresh} />}
          {tab === "alerts" && <AlertsTab alerts={alerts} onRefresh={refresh} />}
          {tab === "news" && <NewsTab news={news} onRefresh={refresh} />}
          {tab === "update" && <TrainUpdateTab updates={updates} onRefresh={refresh} />}
          {tab === "subscribers" && <SubscribersTab subscribers={subscribers} />}
          {tab === "safety" && <SafetyTab incidents={safetyIncidents} onRefresh={refresh} />}
          {tab === "timetable" && <TimetableTab entries={timetableEntries} onRefresh={refresh} />}
          {/* TimetableTab uses its own internal state — entries prop kept for legacy compat */}
          {tab === "coachfeedback" && <CoachFeedbackTab feedback={coachFeedback} />}
          {tab === "lostfound" && <LostFoundTab items={lostFoundItems} onRefresh={refresh} />}
          {tab === "tickets" && <TicketRecoveryTab tickets={adminTickets} onRefresh={() => api.adminTickets().then(setAdminTickets).catch(() => {})} />}
        </main>
      </div>
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────
function OverviewTab({ stats, schedules, alerts }: { stats: Stats; schedules: TrainSchedule[]; alerts: ServiceAlert[] }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Schedules" value={stats.totalSchedules} color="bg-primary" />
        <StatCard label="On Time" value={stats.onTime} color="bg-success" />
        <StatCard label="Delayed" value={stats.delayed} color="bg-warning" />
        <StatCard label="Cancelled" value={stats.cancelled} color="bg-destructive" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active Alerts" value={stats.totalAlerts} color="bg-primary" />
        <StatCard label="Critical Alerts" value={stats.criticalAlerts} color="bg-destructive" />
        <StatCard label="Subscribers" value={stats.totalSubscribers} color="bg-primary" />
      </div>
      <div className="rounded-md border border-border bg-card">
        <div className="border-b border-border px-4 py-3 font-semibold text-foreground">Recent schedules</div>
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
            <tr><Th>Train</Th><Th>Route</Th><Th>Depart</Th><Th>Status</Th></tr>
          </thead>
          <tbody>
            {schedules.slice(0, 5).map((s) => (
              <tr key={s.id} className="border-t border-border">
                <Td>#{s.trainNo}</Td>
                <Td>{s.from} &rarr; {s.to}</Td>
                <Td>{s.departure}</Td>
                <Td><StatusBadge status={s.status} /></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-md border border-border bg-card">
        <div className="border-b border-border px-4 py-3 font-semibold text-foreground">Active alerts</div>
        <div className="divide-y divide-border">
          {alerts.map((a) => (
            <div key={a.id} className="flex items-start gap-3 px-4 py-3">
              <LevelBadge level={a.level} />
              <div>
                <p className="text-sm font-medium text-foreground">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.message}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Schedules CRUD ────────────────────────────────────────────────────────────
const BLANK_SCHEDULE: Partial<TrainSchedule> = {
  trainNo: "", line: "Southern Line", from: "", to: "",
  departure: "", arrival: "", durationMin: 0, stops: [],
  status: "On Time", platform: "", fare: 0,
};

function SchedulesTab({ schedules, onRefresh }: { schedules: TrainSchedule[]; onRefresh: () => void }) {
  const [editing, setEditing] = useState<Partial<TrainSchedule> | null>(null);
  const [isNew, setIsNew] = useState(false);

  async function save() {
    if (!editing) return;
    const payload = { ...editing, stops: typeof editing.stops === "string" ? (editing.stops as unknown as string).split(",").map((s) => s.trim()) : editing.stops };
    if (isNew) await api.createSchedule(payload);
    else await api.updateSchedule(editing.id!, payload);
    setEditing(null);
    onRefresh();
  }

  async function del(id: string) {
    if (!confirm("Delete this schedule?")) return;
    await api.deleteSchedule(id);
    onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { setIsNew(true); setEditing({ ...BLANK_SCHEDULE }); }} className="flex items-center gap-1.5 rounded-sm bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> Add schedule
        </button>
      </div>
      {editing && <ScheduleForm data={editing} onChange={setEditing} onSave={save} onCancel={() => setEditing(null)} isNew={isNew} />}
      <div className="rounded-md border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
            <tr><Th>Train</Th><Th>Line</Th><Th>Route</Th><Th>Depart</Th><Th>Arrive</Th><Th>Status</Th><Th>Fare</Th><th className="px-4 py-2" /></tr>
          </thead>
          <tbody>
            {schedules.map((s) => (
              <tr key={s.id} className="border-t border-border hover:bg-secondary/30">
                <Td>#{s.trainNo}</Td>
                <Td>{s.line}</Td>
                <Td>{s.from} &rarr; {s.to}</Td>
                <Td>{s.departure}</Td>
                <Td>{s.arrival}</Td>
                <Td><StatusBadge status={s.status} /></Td>
                <Td>R{s.fare}</Td>
                <Td>
                  <div className="flex gap-1">
                    <IconBtn onClick={() => { setIsNew(false); setEditing({ ...s, stops: s.stops as unknown as string[] }); }}><Pencil className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn danger onClick={() => del(s.id)}><Trash2 className="h-3.5 w-3.5" /></IconBtn>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScheduleForm({ data, onChange, onSave, onCancel, isNew }: {
  data: Partial<TrainSchedule>; onChange: (d: Partial<TrainSchedule>) => void;
  onSave: () => void; onCancel: () => void; isNew: boolean;
}) {
  const set = (k: keyof TrainSchedule, v: unknown) => onChange({ ...data, [k]: v });
  return (
    <div className="rounded-md border border-primary/40 bg-card p-4">
      <h3 className="mb-3 font-semibold text-foreground">{isNew ? "New schedule" : "Edit schedule"}</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Train No" value={data.trainNo ?? ""} onChange={(v) => set("trainNo", v)} />
        <Field label="From" value={data.from ?? ""} onChange={(v) => set("from", v)} />
        <Field label="To" value={data.to ?? ""} onChange={(v) => set("to", v)} />
        <Field label="Departure (HH:mm)" value={data.departure ?? ""} onChange={(v) => set("departure", v)} />
        <Field label="Arrival (HH:mm)" value={data.arrival ?? ""} onChange={(v) => set("arrival", v)} />
        <Field label="Duration (min)" type="number" value={String(data.durationMin ?? 0)} onChange={(v) => set("durationMin", Number(v))} />
        <Field label="Platform" value={data.platform ?? ""} onChange={(v) => set("platform", v)} />
        <Field label="Fare (ZAR)" type="number" value={String(data.fare ?? 0)} onChange={(v) => set("fare", Number(v))} />
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Line</label>
          <select value={data.line ?? "Southern Line"} onChange={(e) => set("line", e.target.value)} className="w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm text-foreground">
            {["Southern Line","Northern Line","Central Line","Cape Flats Line"].map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
          <select value={data.status ?? "On Time"} onChange={(e) => set("status", e.target.value as TrainSchedule["status"])} className="w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm text-foreground">
            {["On Time","Delayed","Cancelled"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        {data.status === "Delayed" && (
          <Field label="Delay (min)" type="number" value={String(data.delayMin ?? 0)} onChange={(v) => set("delayMin", Number(v))} />
        )}
      </div>
      <div className="mt-3">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Stops (comma-separated)</label>
        <input
          value={Array.isArray(data.stops) ? data.stops.join(", ") : (data.stops ?? "")}
          onChange={(e) => set("stops", e.target.value.split(",").map((s) => s.trim()))}
          className="w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={onSave} className="flex items-center gap-1 rounded-sm bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90"><Check className="h-3.5 w-3.5" /> Save</button>
        <button onClick={onCancel} className="flex items-center gap-1 rounded-sm border border-border px-3 py-1.5 text-sm hover:bg-secondary"><X className="h-3.5 w-3.5" /> Cancel</button>
      </div>
    </div>
  );
}

// ── Alerts CRUD ───────────────────────────────────────────────────────────────
const BLANK_ALERT: Partial<ServiceAlert> = { level: "info", title: "", message: "", line: "" };

function AlertsTab({ alerts, onRefresh }: { alerts: ServiceAlert[]; onRefresh: () => void }) {
  const [editing, setEditing] = useState<Partial<ServiceAlert> | null>(null);
  const [isNew, setIsNew] = useState(false);

  async function save() {
    if (!editing) return;
    if (isNew) await api.createAlert(editing);
    else await api.updateAlert(editing.id!, editing);
    setEditing(null);
    onRefresh();
  }

  async function del(id: string) {
    if (!confirm("Delete this alert?")) return;
    await api.deleteAlert(id);
    onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { setIsNew(true); setEditing({ ...BLANK_ALERT }); }} className="flex items-center gap-1.5 rounded-sm bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> Post alert
        </button>
      </div>
      {editing && (
        <div className="rounded-md border border-primary/40 bg-card p-4">
          <h3 className="mb-3 font-semibold text-foreground">{isNew ? "New alert" : "Edit alert"}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title" value={editing.title ?? ""} onChange={(v) => setEditing((e) => ({ ...e!, title: v }))} />
            <Field label="Line (optional)" value={editing.line ?? ""} onChange={(v) => setEditing((e) => ({ ...e!, line: v }))} />
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Level</label>
              <select value={editing.level ?? "info"} onChange={(e) => setEditing((ed) => ({ ...ed!, level: e.target.value as ServiceAlert["level"] }))} className="w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm text-foreground">
                {["info","warning","critical"].map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Message</label>
            <textarea rows={3} value={editing.message ?? ""} onChange={(e) => setEditing((ed) => ({ ...ed!, message: e.target.value }))} className="w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={save} className="flex items-center gap-1 rounded-sm bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90"><Check className="h-3.5 w-3.5" /> Save</button>
            <button onClick={() => setEditing(null)} className="flex items-center gap-1 rounded-sm border border-border px-3 py-1.5 text-sm hover:bg-secondary"><X className="h-3.5 w-3.5" /> Cancel</button>
          </div>
        </div>
      )}
      <div className="space-y-3">
        {alerts.map((a) => (
          <div key={a.id} className="flex items-start justify-between gap-3 rounded-md border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <LevelBadge level={a.level} />
              <div>
                <p className="font-medium text-foreground">{a.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{a.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{a.line && `${a.line} · `}{new Date(a.postedAt).toLocaleString("en-ZA")}</p>
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <IconBtn onClick={() => { setIsNew(false); setEditing({ ...a }); }}><Pencil className="h-3.5 w-3.5" /></IconBtn>
              <IconBtn danger onClick={() => del(a.id)}><Trash2 className="h-3.5 w-3.5" /></IconBtn>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── News CRUD ─────────────────────────────────────────────────────────────────
const BLANK_NEWS: Partial<NewsItem> = { title: "", excerpt: "", category: "Network", date: new Date().toISOString().slice(0, 10) };

function NewsTab({ news, onRefresh }: { news: NewsItem[]; onRefresh: () => void }) {
  const [editing, setEditing] = useState<Partial<NewsItem> | null>(null);
  const [isNew, setIsNew] = useState(false);

  async function save() {
    if (!editing) return;
    if (isNew) await api.createNews(editing);
    else await api.updateNews(editing.id!, editing);
    setEditing(null);
    onRefresh();
  }

  async function del(id: string) {
    if (!confirm("Delete this news item?")) return;
    await api.deleteNews(id);
    onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { setIsNew(true); setEditing({ ...BLANK_NEWS }); }} className="flex items-center gap-1.5 rounded-sm bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> Write update
        </button>
      </div>
      {editing && (
        <div className="rounded-md border border-primary/40 bg-card p-4">
          <h3 className="mb-3 font-semibold text-foreground">{isNew ? "New article" : "Edit article"}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title" value={editing.title ?? ""} onChange={(v) => setEditing((e) => ({ ...e!, title: v }))} />
            <Field label="Date" type="date" value={editing.date ?? ""} onChange={(v) => setEditing((e) => ({ ...e!, date: v }))} />
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Category</label>
              <select value={editing.category ?? "Network"} onChange={(e) => setEditing((ed) => ({ ...ed!, category: e.target.value as NewsItem["category"] }))} className="w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm text-foreground">
                {["Network","Upgrade","Community","Press"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Excerpt</label>
            <textarea rows={3} value={editing.excerpt ?? ""} onChange={(e) => setEditing((ed) => ({ ...ed!, excerpt: e.target.value }))} className="w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={save} className="flex items-center gap-1 rounded-sm bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90"><Check className="h-3.5 w-3.5" /> Save</button>
            <button onClick={() => setEditing(null)} className="flex items-center gap-1 rounded-sm border border-border px-3 py-1.5 text-sm hover:bg-secondary"><X className="h-3.5 w-3.5" /> Cancel</button>
          </div>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {news.map((n) => (
          <div key={n.id} className="rounded-md border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="rounded-sm bg-destructive px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-destructive-foreground">{n.category}</span>
              <div className="flex gap-1">
                <IconBtn onClick={() => { setIsNew(false); setEditing({ ...n }); }}><Pencil className="h-3.5 w-3.5" /></IconBtn>
                <IconBtn danger onClick={() => del(n.id)}><Trash2 className="h-3.5 w-3.5" /></IconBtn>
              </div>
            </div>
            <p className="mt-2 font-semibold text-foreground">{n.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{n.excerpt}</p>
            <p className="mt-2 text-xs text-muted-foreground">{new Date(n.date).toLocaleDateString("en-ZA", { dateStyle: "long" })}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Lost & Found Tab ──────────────────────────────────────────────────────────
function LostFoundTab({ items, onRefresh }: { items: LostFoundItem[]; onRefresh: () => void }) {
  const [filterStation, setFilterStation] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState("");

  const filtered = items.filter((item) => {
    if (filterStation && item.station !== filterStation) return false;
    if (filterStatus && item.status !== filterStatus) return false;
    return true;
  });

  const openItems = items.filter((item) => item.status === "open").length;
  const matchedItems = items.filter((item) => item.status === "matched").length;
  const stations = [...new Set(items.map((item) => item.station))].sort();

  async function updateStatus(id: string, status: "open" | "matched") {
    setUpdating(id);
    setUpdateError("");
    try {
      await api.updateLostFoundStatus(id, status);
      onRefresh();
    } catch (error) {
      setUpdateError((error as Error).message ?? "Failed to update status");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Reports" value={items.length} color="bg-primary" />
        <StatCard label="Open Items" value={openItems} color="bg-warning" />
        <StatCard label="Found Items" value={matchedItems} color="bg-success" />
      </div>
      {updateError && (
        <p className="rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {updateError} &mdash; your session may have expired, please <a href="/admin/login" className="underline">log in again</a>.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <select value={filterStation} onChange={(e) => setFilterStation(e.target.value)} className="rounded-sm border border-border bg-background px-3 py-1.5 text-sm text-foreground">
          <option value="">All stations</option>
          {stations.map((station) => <option key={station} value={station}>{station}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-sm border border-border bg-background px-3 py-1.5 text-sm text-foreground">
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="matched">Found</option>
        </select>
        <span className="self-center text-sm text-muted-foreground">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
      </div>
      {filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">No lost &amp; found reports yet.</p>
      ) : (
        <div className="rounded-md border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
              <tr><Th>Item</Th><Th>Station</Th><Th>Date</Th><Th>Contact</Th><Th>Reference</Th><Th>Status</Th><Th>Reported</Th><Th>Actions</Th></tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-t border-border hover:bg-secondary/30">
                  <Td><span className="font-medium">{item.item}</span></Td>
                  <Td>{item.station}</Td>
                  <Td>{new Date(item.date).toLocaleDateString("en-ZA")}</Td>
                  <Td><span className="text-xs text-muted-foreground">{item.contact}</span></Td>
                  <Td><code className="text-xs bg-secondary px-1 py-0.5 rounded">{item.contact_ref}</code></Td>
                  <Td>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.status === "matched" ? "bg-success/15 text-success" : "bg-warning/20 text-foreground"}`}>
                      {item.status === "matched" ? "Found" : "Open"}
                    </span>
                  </Td>
                  <Td>{new Date(item.created_at).toLocaleDateString("en-ZA", { dateStyle: "short" })}</Td>
                  <Td>
                    <div className="flex gap-1">
                      {item.status === "open" && (
                        <button disabled={updating === item.id} onClick={() => updateStatus(item.id, "matched")} className="rounded-sm border border-success/40 px-2 py-1 text-xs text-success hover:bg-success/10 disabled:opacity-50">Mark Found</button>
                      )}
                      {item.status === "matched" && (
                        <button disabled={updating === item.id} onClick={() => updateStatus(item.id, "open")} className="rounded-sm border border-warning/40 px-2 py-1 text-xs text-warning hover:bg-warning/10 disabled:opacity-50">Reopen</button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Shared UI helpers ─────────────────────────────────────────────────────────
function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"}`}>
      {icon} {label}
    </button>
  );
}

function NavItemBadge({ icon, label, active, onClick, count }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void; count: number }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center justify-between gap-2 rounded-sm px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"}`}>
      <span className="flex items-center gap-2">{icon} {label}</span>
      {count > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{count}</span>
      )}
    </button>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color === "bg-primary" ? "text-primary" : color === "bg-success" ? "text-success" : color === "bg-warning" ? "text-warning" : "text-destructive"}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === "On Time" ? "bg-success/15 text-success" : status === "Delayed" ? "bg-warning/20 text-foreground" : "bg-destructive/15 text-destructive";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{status}</span>;
}

function LevelBadge({ level }: { level: string }) {
  const cls = level === "critical" ? "bg-destructive text-destructive-foreground" : level === "warning" ? "bg-warning text-foreground" : "bg-primary text-primary-foreground";
  return <span className={`shrink-0 rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase ${cls}`}>{level}</span>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
    </div>
  );
}

function IconBtn({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`rounded-sm border p-1.5 transition-colors ${danger ? "border-destructive/30 text-destructive hover:bg-destructive/10" : "border-border text-muted-foreground hover:bg-secondary"}`}>
      {children}
    </button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2">{children}</td>;
}

// ── Coach Feedback Tab ────────────────────────────────────────────────────────
function CoachFeedbackTab({ feedback }: { feedback: any[] }) {
  const [filterLine, setFilterLine] = useState("");
  const [filterSentiment, setFilterSentiment] = useState("");

  const filtered = feedback.filter((f) => {
    if (filterLine && f.line !== filterLine) return false;
    if (filterSentiment === "negative" && f.hf_label !== "negative" && f.vader_compound >= -0.2) return false;
    if (filterSentiment === "positive" && f.hf_label !== "positive" && f.vader_compound <= 0.2) return false;
    return true;
  });

  const negative = feedback.filter((f) => f.hf_label === "negative" || f.vader_compound < -0.2).length;
  const positive = feedback.filter((f) => f.hf_label === "positive" && f.vader_compound >= 0).length;

  const byCoach: Record<number, { count: number; negCount: number }> = {};
  feedback.forEach((f) => {
    if (!byCoach[f.coach]) byCoach[f.coach] = { count: 0, negCount: 0 };
    byCoach[f.coach].count++;
    if (f.hf_label === "negative" || f.vader_compound < -0.2) byCoach[f.coach].negCount++;
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Submissions" value={feedback.length} color="bg-primary" />
        <StatCard label="Negative Sentiment" value={negative} color="bg-destructive" />
        <StatCard label="Positive Sentiment" value={positive} color="bg-success" />
      </div>
      {Object.keys(byCoach).length > 0 && (
        <div className="rounded-md border border-border bg-card p-5">
          <h3 className="mb-3 font-semibold text-foreground">Sentiment by Coach</h3>
          <div className="grid gap-3 sm:grid-cols-4">
            {Object.entries(byCoach).sort((a, b) => Number(a[0]) - Number(b[0])).map(([coach, data]) => {
              const negPct = Math.round((data.negCount / data.count) * 100);
              const color = negPct > 60 ? "border-destructive bg-destructive/10" : negPct > 30 ? "border-warning bg-warning/10" : "border-success bg-success/10";
              return (
                <div key={coach} className={`rounded-md border p-3 ${color}`}>
                  <div className="text-lg font-bold text-foreground">Coach {coach}</div>
                  <div className="text-xs text-muted-foreground">{data.count} report{data.count !== 1 ? "s" : ""}</div>
                  <div className="mt-1 text-sm font-semibold">{negPct}% negative</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <select value={filterLine} onChange={(e) => setFilterLine(e.target.value)} className="rounded-sm border border-border bg-background px-3 py-1.5 text-sm text-foreground">
          <option value="">All lines</option>
          {["Southern Line", "Northern Line", "Central Line", "Cape Flats Line"].map((l) => <option key={l}>{l}</option>)}
        </select>
        <select value={filterSentiment} onChange={(e) => setFilterSentiment(e.target.value)} className="rounded-sm border border-border bg-background px-3 py-1.5 text-sm text-foreground">
          <option value="">All sentiments</option>
          <option value="negative">Negative only</option>
          <option value="positive">Positive only</option>
        </select>
        <span className="self-center text-sm text-muted-foreground">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
      </div>
      {filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">No coach feedback submitted yet.</p>
      ) : (
        <div className="rounded-md border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
              <tr><Th>Time</Th><Th>Train</Th><Th>Route</Th><Th>Coach</Th><Th>HF</Th><Th>VADER</Th><Th>Feedback</Th></tr>
            </thead>
            <tbody>
              {filtered.map((f) => {
                const isNeg = f.hf_label === "negative" || f.vader_compound < -0.2;
                return (
                  <tr key={f.id} className={`border-t border-border ${isNeg ? "bg-destructive/5" : ""}`}>
                    <Td>{new Date(f.submitted_at).toLocaleString("en-ZA", { dateStyle: "short", timeStyle: "short" })}</Td>
                    <Td>#{f.train_no} <span className="text-xs text-muted-foreground">{f.line}</span></Td>
                    <Td>{f.from_station} &rarr; {f.to_station}</Td>
                    <Td><span className="font-bold">Coach {f.coach}</span></Td>
                    <Td>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${f.hf_label === "positive" ? "bg-success/15 text-success" : f.hf_label === "negative" ? "bg-destructive/15 text-destructive" : "bg-secondary text-muted-foreground"}`}>
                        {f.hf_label} ({(f.hf_confidence * 100).toFixed(0)}%)
                      </span>
                    </Td>
                    <Td>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${f.vader_compound >= 0.2 ? "bg-success/15 text-success" : f.vader_compound <= -0.2 ? "bg-destructive/15 text-destructive" : "bg-secondary text-muted-foreground"}`}>
                        {f.vader_label} ({f.vader_compound.toFixed(2)})
                      </span>
                    </Td>
                    <Td><span className="line-clamp-2 block max-w-xs text-muted-foreground">{f.feedback_text}</span></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Train Update Tab ──────────────────────────────────────────────────────────
const BLANK_UPDATE = { trainNo: "", line: "Southern Line" as const, station: "", status: "Delayed" as const, delayMin: 0, reason: "" };

function TrainUpdateTab({ updates, onRefresh }: { updates: TrainUpdateRecord[]; onRefresh: () => void }) {
  const [form, setForm] = useState({ ...BLANK_UPDATE });
  const [result, setResult] = useState<{ message: string; notified: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await api.trainUpdate(form);
      setResult(res);
      setForm({ ...BLANK_UPDATE });
      onRefresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-border bg-card p-5">
        <h2 className="mb-4 font-semibold text-foreground">Post train status update</h2>
        <p className="mb-4 text-sm text-muted-foreground">Subscribers at the selected station will receive an instant email and SMS notification.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Train Number" value={form.trainNo} onChange={(v) => setForm((f) => ({ ...f, trainNo: v }))} />
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Station</label>
              <select required value={form.station} onChange={(e) => setForm((f) => ({ ...f, station: e.target.value }))} className="w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">Select a station&hellip;</option>
                {STATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Line</label>
              <select value={form.line} onChange={(e) => setForm((f) => ({ ...f, line: e.target.value as typeof form.line }))} className="w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm text-foreground">
                {["Southern Line","Northern Line","Central Line","Cape Flats Line"].map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as typeof form.status }))} className="w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm text-foreground">
                {["On Time","Delayed","Cancelled"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            {form.status === "Delayed" && (
              <Field label="Delay (minutes)" type="number" value={String(form.delayMin)} onChange={(v) => setForm((f) => ({ ...f, delayMin: Number(v) }))} />
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Reason (optional)</label>
            <textarea rows={2} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="e.g. Cable theft, signal failure, track maintenance&hellip;" className="w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {result && (
            <div className="rounded-sm bg-success/10 p-3 text-sm text-success">
              {result.message} &mdash; <strong>{result.notified}</strong> subscriber(s) notified.
            </div>
          )}
          <button type="submit" disabled={loading} className="flex items-center gap-2 rounded-sm bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-60">
            <Send className="h-4 w-4" />
            {loading ? "Sending\u2026" : "Post update & notify subscribers"}
          </button>
        </form>
      </div>
      {updates.length > 0 && (
        <div className="rounded-md border border-border bg-card">
          <div className="border-b border-border px-4 py-3 font-semibold text-foreground">Recent updates</div>
          <div className="divide-y divide-border">
            {updates.slice(0, 10).map((u) => (
              <div key={u.id} className="flex items-start gap-3 px-4 py-3">
                <StatusBadge status={u.status} />
                <div>
                  <p className="text-sm font-medium text-foreground">Train #{u.train_no} &middot; {u.station} &middot; {u.line}</p>
                  {u.reason && <p className="text-xs text-muted-foreground">{u.reason}</p>}
                  <p className="text-xs text-muted-foreground">{new Date(u.updated_at).toLocaleString("en-ZA")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Subscribers Tab ───────────────────────────────────────────────────────────
function SubscribersTab({ subscribers }: { subscribers: Subscriber[] }) {
  const [search, setSearch] = useState("");
  const filtered = subscribers.filter(
    (s) => s.email.toLowerCase().includes(search.toLowerCase()) || s.station.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by email or station&hellip;" className="flex-1 rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        <span className="text-sm text-muted-foreground">{filtered.length} subscriber{filtered.length !== 1 ? "s" : ""}</span>
      </div>
      {subscribers.length === 0 ? (
        <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No subscribers yet. Users can register at <strong>/register</strong>.
        </div>
      ) : (
        <div className="rounded-md border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
              <tr><Th>Email</Th><Th>Home Station</Th><Th>Registered</Th></tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-secondary/30">
                  <Td>{s.email}</Td>
                  <Td>{s.station}</Td>
                  <Td>{new Date(s.created_at).toLocaleDateString("en-ZA")}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Safety Tab ────────────────────────────────────────────────────────────────
const TYPE_COLOR: Record<string, string> = {
  "Suspicious activity": "bg-warning/20 text-foreground border-warning/40",
  "Theft / robbery":     "bg-destructive/15 text-destructive border-destructive/30",
  "Damage / vandalism":  "bg-destructive/15 text-destructive border-destructive/30",
  "Medical assistance":  "bg-primary/15 text-primary border-primary/30",
  "Other":               "bg-secondary text-muted-foreground border-border",
};

function SafetyTab({ incidents, onRefresh }: { incidents: SafetyIncident[]; onRefresh: () => void }) {
  const [updating, setUpdating] = useState<string | null>(null);
  const pending = incidents.filter((i) => i.status === "pending");

  async function updateStatus(id: string, status: string) {
    setUpdating(id);
    try { await api.updateSafetyStatus(id, status); onRefresh(); }
    finally { setUpdating(null); }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Reports" value={incidents.length} color="bg-primary" />
        <StatCard label="Pending" value={pending.length} color="bg-destructive" />
        <StatCard label="Resolved" value={incidents.filter((i) => i.status === "resolved").length} color="bg-success" />
      </div>
      {pending.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            <span className="font-semibold text-foreground">Pending &mdash; requires action</span>
            <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{pending.length}</span>
          </div>
          <div className="divide-y divide-border">
            {pending.map((inc) => (
              <div key={inc.id} className="flex items-start gap-3 px-4 py-4">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${TYPE_COLOR[inc.type] ?? ""}`}>{inc.type}</span>
                    <span className="text-xs text-muted-foreground">{inc.station}</span>
                    <span className="text-xs text-muted-foreground">{new Date(inc.created_at).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}</span>
                  </div>
                  <p className="mt-1 text-sm text-foreground">{inc.details}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button disabled={updating === inc.id} onClick={() => updateStatus(inc.id, "in_progress")} className="rounded-sm border border-warning/40 px-2 py-1 text-xs text-warning hover:bg-warning/10 disabled:opacity-50">In progress</button>
                  <button disabled={updating === inc.id} onClick={() => updateStatus(inc.id, "resolved")} className="rounded-sm border border-success/40 px-2 py-1 text-xs text-success hover:bg-success/10 disabled:opacity-50">Resolve</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="rounded-md border border-border bg-card">
        <div className="border-b border-border px-4 py-3 font-semibold text-foreground">All reports</div>
        {incidents.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No safety reports yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
                <tr><Th>Type</Th><Th>Station</Th><Th>Details</Th><Th>Status</Th><Th>Reported</Th><th className="px-4 py-2" /></tr>
              </thead>
              <tbody>
                {incidents.map((inc) => (
                  <tr key={inc.id} className="border-t border-border hover:bg-secondary/30">
                    <Td><span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${TYPE_COLOR[inc.type] ?? "bg-secondary border-border text-foreground"}`}>{inc.type}</span></Td>
                    <Td>{inc.station}</Td>
                    <Td><span className="line-clamp-2 block max-w-xs text-muted-foreground">{inc.details}</span></Td>
                    <Td>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${inc.status === "resolved" ? "bg-success/15 text-success" : inc.status === "in_progress" ? "bg-warning/20 text-foreground" : "bg-destructive/15 text-destructive"}`}>{inc.status}</span>
                    </Td>
                    <Td>{new Date(inc.created_at).toLocaleString("en-ZA", { dateStyle: "short", timeStyle: "short" })}</Td>
                    <Td>
                      <div className="flex gap-1">
                        {inc.status !== "in_progress" && inc.status !== "resolved" && (
                          <button disabled={updating === inc.id} onClick={() => updateStatus(inc.id, "in_progress")} className="rounded-sm border border-warning/40 px-2 py-1 text-xs text-warning hover:bg-warning/10 disabled:opacity-50">In progress</button>
                        )}
                        {inc.status !== "resolved" && (
                          <button disabled={updating === inc.id} onClick={() => updateStatus(inc.id, "resolved")} className="rounded-sm border border-success/40 px-2 py-1 text-xs text-success hover:bg-success/10 disabled:opacity-50">Resolve</button>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Timetable Tab ─────────────────────────────────────────────────────────────
const BLANK_STOP = { route_id: "", train_no: "", station_name: "", stop_order: 1, departure: "", platform: "" };

const BLANK_ROUTE = {
  id: "", line_name: "Central Line", direction: "down" as "down" | "up",
  from_station: "", to_station: "", days_of_operation: "Mon-Fri",
};

// Parse bulk timetable paste: each line = "Station Name HH:mm HH:mm ..." ("-" = skip)
function parseBulkStops(
  routeId: string, stationLines: string, trainNos: string, platform: string,
): { train_no: string; station_name: string; stop_order: number; departure: string | null; platform: string | null }[] {
  const trains = trainNos.split(",").map((t) => t.trim()).filter(Boolean);
  const rows: { train_no: string; station_name: string; stop_order: number; departure: string | null; platform: string | null }[] = [];
  stationLines.split("\n").forEach((line, si) => {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) return;
    const ti = parts.findIndex((p) => /^\d{1,2}:\d{2}$/.test(p) || p === "-");
    if (ti === -1) return;
    const stationName = parts.slice(0, ti).join(" ");
    parts.slice(ti).forEach((t, trainIdx) => {
      if (trainIdx >= trains.length) return;
      rows.push({ train_no: trains[trainIdx], station_name: stationName, stop_order: si + 1, departure: t === "-" ? null : t, platform: platform || null });
    });
  });
  return rows;
}function TimetableTab({ onRefresh: _onRefresh }: { entries: Record<string, unknown>[]; onRefresh: () => void }) {
  const [routes, setRoutes] = useState<PrasaRoute[]>([]);
  const [selectedRoute, setSelectedRoute] = useState("");
  const [stops, setStops] = useState<TimetableStop[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [loadingStops, setLoadingStops] = useState(false);
  const [editingStop, setEditingStop] = useState<typeof BLANK_STOP | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingTrain, setDeletingTrain] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    api.adminTimetableRoutes()
      .then((r) => { setRoutes(r); if (r.length > 0) setSelectedRoute(r[0].id); })
      .catch(() => {})
      .finally(() => setLoadingRoutes(false));
  }, []);

  useEffect(() => {
    if (!selectedRoute) return;
    setLoadingStops(true);
    api.adminTimetableByRoute(selectedRoute)
      .then(setStops)
      .catch(() => setStops([]))
      .finally(() => setLoadingStops(false));
  }, [selectedRoute]);

  // ── New route state ───────────────────────────────────────────────────────
  const [showNewRoute, setShowNewRoute] = useState(false);
  const [newRoute, setNewRoute] = useState({ ...BLANK_ROUTE });
  const [bulkStationLines, setBulkStationLines] = useState("");
  const [bulkTrainNos, setBulkTrainNos] = useState("");
  const [bulkPlatform, setBulkPlatform] = useState("");
  const [creatingRoute, setCreatingRoute] = useState(false);
  const [deletingRoute, setDeletingRoute] = useState(false);

  async function reloadRoutes(selectId?: string) {
    const r = await api.adminTimetableRoutes().catch(() => [] as PrasaRoute[]);
    setRoutes(r);
    if (selectId) setSelectedRoute(selectId);
    else if (r.length > 0 && !selectedRoute) setSelectedRoute(r[0].id);
  }

  async function createRoute(e: React.FormEvent) {
    e.preventDefault();
    setCreatingRoute(true); setMsg(null);
    try {
      await api.adminCreateRoute(newRoute);
      if (bulkStationLines.trim() && bulkTrainNos.trim()) {
        const stopRows = parseBulkStops(newRoute.id, bulkStationLines, bulkTrainNos, bulkPlatform);
        if (stopRows.length > 0) {
          const res = await api.adminBulkStops(newRoute.id, stopRows);
          setMsg({ type: "ok", text: `Route "${newRoute.id}" created with ${res.inserted} stop-times.` });
        } else {
          setMsg({ type: "ok", text: "Route created. No stops parsed — check format." });
        }
      } else {
        setMsg({ type: "ok", text: `Route "${newRoute.id}" created. Add stops using the form.` });
      }
      const createdId = newRoute.id;
      setShowNewRoute(false);
      setNewRoute({ ...BLANK_ROUTE });
      setBulkStationLines(""); setBulkTrainNos(""); setBulkPlatform("");
      await reloadRoutes(createdId);
    } catch (err) {
      setMsg({ type: "err", text: (err as Error).message });
    } finally {
      setCreatingRoute(false);
    }
  }

  async function deleteRoute() {
    if (!selectedRoute || !confirm(`Delete route "${selectedRoute}" and ALL its timetable data? Cannot be undone.`)) return;
    setDeletingRoute(true);
    try {
      await api.adminDeleteRoute(selectedRoute);
      setMsg({ type: "ok", text: `Route "${selectedRoute}" deleted.` });
      setSelectedRoute(""); setStops([]);
      await reloadRoutes();
    } catch (err) {
      setMsg({ type: "err", text: (err as Error).message });
    } finally {
      setDeletingRoute(false);
    }
  }

  async function saveStop(e: React.FormEvent) {
    e.preventDefault();
    if (!editingStop) return;
    setSaving(true); setMsg(null);
    try {
      await api.adminUpsertStop({
        route_id: editingStop.route_id || selectedRoute,
        train_no: editingStop.train_no,
        station_name: editingStop.station_name,
        stop_order: Number(editingStop.stop_order),
        departure: editingStop.departure || null,
        platform: editingStop.platform || undefined,
      });
      setMsg({ type: "ok", text: `Stop saved for Train ${editingStop.train_no} at ${editingStop.station_name}.` });
      setEditingStop(null);
      // Reload stops
      const updated = await api.adminTimetableByRoute(selectedRoute);
      setStops(updated);
    } catch (err) {
      setMsg({ type: "err", text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function deleteTrain(trainNo: string) {
    if (!confirm(`Delete ALL stops for Train ${trainNo}?`)) return;
    setDeletingTrain(trainNo);
    try {
      await api.adminDeleteTrain(trainNo);
      const updated = await api.adminTimetableByRoute(selectedRoute);
      setStops(updated);
      setMsg({ type: "ok", text: `Train ${trainNo} removed.` });
    } catch (err) {
      setMsg({ type: "err", text: (err as Error).message });
    } finally {
      setDeletingTrain("");
    }
  }

  // Group stops by train number for display
  const trainNos = [...new Set(stops.map((s) => s.train_no))].sort();

  const currentRoute = routes.find((r) => r.id === selectedRoute);

  return (
    <div className="space-y-6">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Route</label>
          <select value={selectedRoute} onChange={(e) => setSelectedRoute(e.target.value)}
            className="rounded-sm border border-border bg-background px-3 py-1.5 text-sm text-foreground" disabled={loadingRoutes}>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>{r.line_name} — {r.direction === "down" ? "↓" : "↑"} {r.from_station} → {r.to_station} ({r.days_of_operation})</option>
            ))}
          </select>
        </div>
        {currentRoute && <div className="rounded-sm bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">{stops.length} stop-times · {trainNos.length} trains</div>}
        <button onClick={() => { setEditingStop({ ...BLANK_STOP, route_id: selectedRoute }); setMsg(null); }}
          className="flex items-center gap-1.5 rounded-sm bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> Add stop
        </button>
        <button onClick={() => { setShowNewRoute((v) => !v); setMsg(null); }}
          className="flex items-center gap-1.5 rounded-sm border border-primary px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/10">
          <Plus className="h-4 w-4" /> New route
        </button>
        {selectedRoute && (
          <button disabled={deletingRoute} onClick={deleteRoute}
            className="flex items-center gap-1.5 rounded-sm border border-destructive/50 px-3 py-1.5 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50">
            <Trash2 className="h-4 w-4" /> {deletingRoute ? "Deleting…" : "Delete route"}
          </button>
        )}
      </div>

      {/* New route form */}
      {showNewRoute && (
        <div className="rounded-md border border-primary/40 bg-card p-5">
          <h3 className="mb-1 font-semibold text-foreground">Create a new route</h3>
          <p className="mb-4 text-xs text-muted-foreground">A route groups a set of timetable stop-times. You can optionally paste bulk stop data below.</p>
          <form onSubmit={createRoute} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Route ID (unique slug)</label>
                <input required value={newRoute.id} onChange={(e) => setNewRoute((r) => ({ ...r, id: e.target.value }))}
                  placeholder="e.g. southern-down-1"
                  className="w-full rounded-sm border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Line name</label>
                <input required value={newRoute.line_name} onChange={(e) => setNewRoute((r) => ({ ...r, line_name: e.target.value }))}
                  placeholder="e.g. Southern Line"
                  className="w-full rounded-sm border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Direction</label>
                <select value={newRoute.direction} onChange={(e) => setNewRoute((r) => ({ ...r, direction: e.target.value as "down" | "up" }))}
                  className="w-full rounded-sm border border-border bg-background px-3 py-1.5 text-sm text-foreground">
                  <option value="down">Down ↓</option>
                  <option value="up">Up ↑</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">From station</label>
                <input required value={newRoute.from_station} onChange={(e) => setNewRoute((r) => ({ ...r, from_station: e.target.value }))}
                  placeholder="e.g. Cape Town"
                  className="w-full rounded-sm border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">To station</label>
                <input required value={newRoute.to_station} onChange={(e) => setNewRoute((r) => ({ ...r, to_station: e.target.value }))}
                  placeholder="e.g. Stellenbosch"
                  className="w-full rounded-sm border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Days of operation</label>
                <input value={newRoute.days_of_operation} onChange={(e) => setNewRoute((r) => ({ ...r, days_of_operation: e.target.value }))}
                  placeholder="e.g. Mon-Fri"
                  className="w-full rounded-sm border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-xs font-medium text-muted-foreground">Bulk stop-times (optional)</p>
              <p className="text-xs text-muted-foreground">
                Each line: <code className="rounded bg-secondary px-1">Station Name HH:mm HH:mm …</code> (use <code className="rounded bg-secondary px-1">-</code> to skip a train at that stop).
                Train numbers: comma-separated, matching the time columns.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Station lines</label>
                  <textarea rows={5} value={bulkStationLines} onChange={(e) => setBulkStationLines(e.target.value)}
                    placeholder={"Cape Town 06:00 06:30\nSalt River 06:08 06:38\nWoodstock 06:12 -"}
                    className="w-full rounded-sm border border-border bg-background px-3 py-1.5 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Train numbers (comma-separated)</label>
                    <input value={bulkTrainNos} onChange={(e) => setBulkTrainNos(e.target.value)}
                      placeholder="9001, 9003"
                      className="w-full rounded-sm border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Default platform (optional)</label>
                    <input value={bulkPlatform} onChange={(e) => setBulkPlatform(e.target.value)}
                      placeholder="1"
                      className="w-full rounded-sm border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                </div>
              </div>
            </div>

            {msg && <p className={`rounded-sm p-2 text-sm ${msg.type === "ok" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>{msg.text}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={creatingRoute}
                className="flex items-center gap-1.5 rounded-sm bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60">
                <Check className="h-3.5 w-3.5" /> {creatingRoute ? "Creating…" : "Create route"}
              </button>
              <button type="button" onClick={() => { setShowNewRoute(false); setNewRoute({ ...BLANK_ROUTE }); setBulkStationLines(""); setBulkTrainNos(""); setBulkPlatform(""); }}
                className="flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 text-sm hover:bg-secondary">
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add / edit stop form */}
      {editingStop && (
        <div className="rounded-md border border-primary/40 bg-card p-5">
          <h3 className="mb-3 font-semibold text-foreground">Add or update a stop time</h3>
          <p className="mb-4 text-xs text-muted-foreground">If the train + station combination already exists it will be updated (upsert).</p>
          <form onSubmit={saveStop} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Train No" value={editingStop.train_no} onChange={(v) => setEditingStop((s) => s && ({ ...s, train_no: v }))} />
              <Field label="Station Name" value={editingStop.station_name} onChange={(v) => setEditingStop((s) => s && ({ ...s, station_name: v }))} />
              <Field label="Stop Order" type="number" value={String(editingStop.stop_order)} onChange={(v) => setEditingStop((s) => s && ({ ...s, stop_order: Number(v) }))} />
              <Field label="Departure (HH:mm or blank to skip)" value={editingStop.departure} onChange={(v) => setEditingStop((s) => s && ({ ...s, departure: v }))} />
              <Field label="Platform (optional)" value={editingStop.platform} onChange={(v) => setEditingStop((s) => s && ({ ...s, platform: v }))} />
            </div>
            {msg && <p className={`rounded-sm p-2 text-sm ${msg.type === "ok" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>{msg.text}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="flex items-center gap-1.5 rounded-sm bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60">
                <Check className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save stop"}
              </button>
              <button type="button" onClick={() => setEditingStop(null)} className="flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 text-sm hover:bg-secondary">
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {msg && !editingStop && (
        <p className={`rounded-sm p-3 text-sm ${msg.type === "ok" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>{msg.text}</p>
      )}

      {/* Timetable grid grouped by train */}
      {loadingStops ? (
        <p className="text-sm text-muted-foreground">Loading timetable…</p>
      ) : trainNos.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No timetable data for this route yet. Run <code className="text-xs">npm run seed:timetable</code> to seed the Stellenbosch Line data, or use the form above.
        </p>
      ) : (
        <div className="rounded-md border border-border bg-card overflow-x-auto">
          <div className="border-b border-border px-4 py-3">
            <span className="font-semibold text-foreground">{currentRoute?.line_name} — {currentRoute?.from_station} → {currentRoute?.to_station}</span>
            <span className="ml-2 text-xs text-muted-foreground">({currentRoute?.days_of_operation})</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
              <tr>
                <Th>Train</Th>
                <Th>Station</Th>
                <Th>Order</Th>
                <Th>Departure</Th>
                <Th>Platform</Th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {trainNos.map((trainNo) => {
                const trainStops = stops.filter((s) => s.train_no === trainNo);
                return trainStops.map((s, idx) => (
                  <tr key={`${s.train_no}-${s.stop_order}`} className="border-t border-border hover:bg-secondary/30">
                    {idx === 0 && (
                      <td rowSpan={trainStops.length} className="border-r border-border px-4 py-2 align-top font-mono font-semibold text-primary">
                        #{trainNo}
                        <button
                          disabled={deletingTrain === trainNo}
                          onClick={() => deleteTrain(trainNo)}
                          className="ml-2 rounded-sm border border-destructive/30 px-1.5 py-0.5 text-[10px] text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        >
                          {deletingTrain === trainNo ? "…" : "Del"}
                        </button>
                      </td>
                    )}
                    <Td>{s.station_name}</Td>
                    <Td>{s.stop_order}</Td>
                    <Td>{s.departure ?? <span className="text-xs text-muted-foreground">skip</span>}</Td>
                    <Td>{(s as any).platform ?? "—"}</Td>
                    <Td>
                      <button
                        onClick={() => setEditingStop({
                          route_id: selectedRoute,
                          train_no: s.train_no,
                          station_name: s.station_name,
                          stop_order: s.stop_order,
                          departure: s.departure ?? "",
                          platform: (s as any).platform ?? "",
                        })}
                        className="rounded-sm border border-border p-1 text-muted-foreground hover:bg-secondary"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </Td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Ticket Recovery Tab ───────────────────────────────────────────────────────
function TicketRecoveryTab({ tickets, onRefresh }: { tickets: AdminTicket[]; onRefresh: () => void }) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [lineFilter, setLineFilter] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<AdminTicket[]>([]);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<AdminTicket | null>(null);
  const [reissuing, setReissuing] = useState(false);
  const [reissueResult, setReissueResult] = useState<{ channel: string; status: string; error?: string }[] | null>(null);
  const [channels, setChannels] = useState<{ email: boolean; sms: boolean }>({ email: true, sms: false });

  useEffect(() => {
    api.adminTickets().then((data) => { setResults(data); setSearched(true); }).catch(() => {});
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setReissueResult(null);
    setSelected(null);
    try {
      const data = await api.adminTickets({
        q: q || undefined,
        status: statusFilter || undefined,
        line: lineFilter || undefined,
      });
      setResults(data);
      setSearched(true);
    } finally {
      setSearching(false);
    }
  }

  async function handleReissue() {
    if (!selected) return;
    const ch: ("email" | "sms")[] = [];
    if (channels.email) ch.push("email");
    if (channels.sms) ch.push("sms");
    if (!ch.length) return;
    setReissuing(true);
    setReissueResult(null);
    try {
      const res = await api.reissueTicket(selected.id, ch);
      setReissueResult(res.results);
      onRefresh();
    } catch (err) {
      setReissueResult([{ channel: "error", status: "failed", error: (err as Error).message }]);
    } finally {
      setReissuing(false);
    }
  }

  const paid    = tickets.filter((t) => t.payment_status === "paid").length;
  const pending = tickets.filter((t) => t.payment_status === "pending").length;
  const used    = tickets.filter((t) => t.used).length;
  const totalRevenue = tickets
    .filter((t) => t.payment_status === "paid")
    .reduce((sum, t) => sum + Number(t.fare), 0);

  // Revenue grouped by departure station (paid tickets only)
  const revenueByStation = Object.entries(
    tickets
      .filter((t) => t.payment_status === "paid")
      .reduce<Record<string, { revenue: number; count: number }>>((acc, t) => {
        const key = t.from_station;
        if (!acc[key]) acc[key] = { revenue: 0, count: 0 };
        acc[key].revenue += Number(t.fare);
        acc[key].count += 1;
        return acc;
      }, {}),
  )
    .map(([station, data]) => ({ station, ...data }))
    .sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Total Tickets"   value={tickets.length} color="bg-primary" />
        <StatCard label="Paid"            value={paid}           color="bg-success" />
        <StatCard label="Pending Payment" value={pending}        color="bg-warning" />
        <StatCard label="Used / Scanned"  value={used}           color="bg-primary" />
      </div>

      {/* ── Revenue by station ── */}
      <div className="rounded-md border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-foreground">Revenue by departure station</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Paid tickets only · {paid} ticket{paid !== 1 ? "s" : ""}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total revenue</p>
            <p className="text-xl font-bold text-success">R{totalRevenue.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>
        {revenueByStation.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No paid tickets yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <Th>Departure station</Th>
                  <Th>Tickets sold</Th>
                  <Th>Revenue (ZAR)</Th>
                  <Th>% of total</Th>
                </tr>
              </thead>
              <tbody>
                {revenueByStation.map(({ station, revenue, count }) => {
                  const pct = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
                  return (
                    <tr key={station} className="border-t border-border hover:bg-secondary/30">
                      <Td><span className="font-medium">{station}</span></Td>
                      <Td>{count}</Td>
                      <Td><span className="font-semibold text-success">R{revenue.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                            <div className="h-full rounded-full bg-success" style={{ width: `${pct.toFixed(1)}%` }} />
                          </div>
                          <span className="w-10 text-right text-xs text-muted-foreground">{pct.toFixed(1)}%</span>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-md border border-border bg-card p-5">
        <h2 className="mb-1 font-semibold text-foreground">Search tickets</h2>
        <p className="mb-4 text-sm text-muted-foreground">Search by passenger name, ID number, email, phone, booking reference, or transaction ID.</p>
        <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
          <div className="relative min-w-60 flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, ID, email, phone, TKT-ref, transaction ID&hellip;" className="w-full rounded-sm border border-border bg-background py-2 pl-8 pr-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-sm border border-border bg-background px-2 py-2 text-sm text-foreground">
            <option value="">All statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <select value={lineFilter} onChange={(e) => setLineFilter(e.target.value)} className="rounded-sm border border-border bg-background px-2 py-2 text-sm text-foreground">
            <option value="">All lines</option>
            {["Southern Line", "Northern Line", "Central Line", "Cape Flats Line"].map((l) => <option key={l}>{l}</option>)}
          </select>
          <button type="submit" disabled={searching} className="flex items-center gap-1.5 rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60">
            <Search className="h-4 w-4" />
            {searching ? "Searching\u2026" : "Search"}
          </button>
        </form>
      </div>

      {searched && (
        <div className="rounded-md border border-border bg-card">
          <div className="border-b border-border px-4 py-3 font-semibold text-foreground">
            Results &mdash; {results.length} ticket{results.length !== 1 ? "s" : ""}
          </div>
          {results.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No tickets found matching your search.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <Th>Reference</Th><Th>Passenger</Th><Th>Contact</Th>
                    <Th>Route</Th><Th>Train</Th><Th>Departs</Th>
                    <Th>Fare</Th><Th>Payment</Th><Th>Used</Th><Th>Booked</Th><th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {results.map((t) => (
                    <tr
                      key={t.id}
                      className={`cursor-pointer border-t border-border hover:bg-secondary/40 ${selected?.id === t.id ? "bg-primary/5 ring-1 ring-inset ring-primary/20" : ""}`}
                      onClick={() => { setSelected(t); setReissueResult(null); }}
                    >
                      <Td><code className="rounded bg-secondary px-1 py-0.5 text-xs">{t.ticket_ref}</code></Td>
                      <Td>
                        <p className="font-medium">{t.passenger_name ?? <span className="italic text-muted-foreground">Unknown</span>}</p>
                        {t.id_number && <p className="text-xs text-muted-foreground">ID: {t.id_number}</p>}
                      </Td>
                      <Td>
                        {t.email && <p className="text-xs">{t.email}</p>}
                        {t.phone && <p className="text-xs text-muted-foreground">{t.phone}</p>}
                      </Td>
                      <Td>{t.from_station} &rarr; {t.to_station}</Td>
                      <Td>#{t.train_no} <span className="text-xs text-muted-foreground">{t.line}</span></Td>
                      <Td>{t.departure}</Td>
                      <Td>R{Number(t.fare).toFixed(2)}</Td>
                      <Td>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.payment_status === "paid" ? "bg-success/15 text-success" : t.payment_status === "pending" ? "bg-warning/20 text-foreground" : "bg-destructive/15 text-destructive"}`}>{t.payment_status}</span>
                      </Td>
                      <Td>
                        {t.used
                          ? <span className="text-xs text-muted-foreground">&#10003; {t.used_at ? new Date(t.used_at).toLocaleDateString("en-ZA") : "yes"}</span>
                          : <span className="text-xs text-success">Active</span>}
                      </Td>
                      <Td>{new Date(t.booked_at).toLocaleDateString("en-ZA", { dateStyle: "short" })}</Td>
                      <Td>
                        <button onClick={(e) => { e.stopPropagation(); setSelected(t); setReissueResult(null); }} className="rounded-sm border border-primary/40 px-2 py-1 text-xs text-primary hover:bg-primary/10">Select</button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {selected && (
        <div className="rounded-md border border-primary/30 bg-card p-5 space-y-4">
          <h3 className="flex items-center gap-2 font-semibold text-foreground">
            <Ticket className="h-4 w-4 text-primary" />
            Ticket details &mdash; {selected.ticket_ref}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Passenger name"  value={selected.passenger_name ?? "\u2014"} />
            <Detail label="ID number"       value={selected.id_number ?? "\u2014"} />
            <Detail label="Email"           value={selected.email ?? "\u2014"} />
            <Detail label="Phone"           value={selected.phone ?? "\u2014"} />
            <Detail label="Route"           value={`${selected.from_station} \u2192 ${selected.to_station}`} />
            <Detail label="Train"           value={`#${selected.train_no} \u00b7 ${selected.line}`} />
            <Detail label="Departure"       value={selected.departure} />
            <Detail label="Arrival"         value={selected.arrival ?? "\u2014"} />
            <Detail label="Fare"            value={`R${Number(selected.fare).toFixed(2)}`} />
            <Detail label="Travel class"    value={selected.travel_class} />
            <Detail label="Payment status"  value={selected.payment_status.toUpperCase()} />
            <Detail label="Transaction ID"  value={selected.payment_intent_id ?? "\u2014"} mono />
            <Detail label="Booked at"       value={new Date(selected.booked_at).toLocaleString("en-ZA")} />
            <Detail label="Ticket used"     value={selected.used ? `Yes${selected.used_at ? ` \u2014 ${new Date(selected.used_at).toLocaleString("en-ZA")}` : ""}` : "No \u2014 still active"} />
          </div>
          <div className="border-t border-border pt-4">
            <p className="mb-3 text-sm font-medium text-foreground">Reissue / resend ticket to passenger</p>
            <div className="mb-3 flex flex-wrap gap-4 text-sm">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={channels.email} onChange={(e) => setChannels((c) => ({ ...c, email: e.target.checked }))} disabled={!selected.email} />
                <span className={!selected.email ? "text-muted-foreground line-through" : ""}>
                  Email{selected.email ? ` (${selected.email})` : " \u2014 no email on record"}
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={channels.sms} onChange={(e) => setChannels((c) => ({ ...c, sms: e.target.checked }))} disabled={!selected.phone} />
                <span className={!selected.phone ? "text-muted-foreground line-through" : ""}>
                  SMS{selected.phone ? ` (${selected.phone})` : " \u2014 no phone on record"}
                </span>
              </label>
            </div>
            {reissueResult && (
              <div className="mb-3 space-y-1">
                {reissueResult.map((r, i) => (
                  <p key={i} className={`rounded-sm px-3 py-1.5 text-sm ${r.status === "sent" ? "bg-success/10 text-success" : r.status === "skipped" ? "bg-secondary text-muted-foreground" : "bg-destructive/10 text-destructive"}`}>
                    {r.channel.toUpperCase()}: {r.status}{r.error ? ` \u2014 ${r.error}` : ""}
                  </p>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={handleReissue} disabled={reissuing || (!channels.email && !channels.sms)} className="flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60">
                <RotateCcw className="h-4 w-4" />
                {reissuing ? "Sending\u2026" : "Reissue ticket"}
              </button>
              <button onClick={() => { setSelected(null); setReissueResult(null); }} className="rounded-sm border border-border px-3 py-2 text-sm hover:bg-secondary">Clear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-sm text-foreground ${mono ? "break-all font-mono text-xs" : ""}`}>{value}</p>
    </div>
  );
}

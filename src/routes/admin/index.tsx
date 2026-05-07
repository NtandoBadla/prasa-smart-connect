import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { TrainSchedule, ServiceAlert } from "@/data/prasa";
import type { NewsItem } from "@/data/extras";
import { STATIONS } from "@/data/prasa";
import {
  Train, AlertTriangle, Newspaper, LayoutDashboard,
  LogOut, Plus, Pencil, Trash2, Check, X, RefreshCw,
  Users, Send, Bell, ShieldAlert, CalendarClock,
} from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

type Tab = "overview" | "schedules" | "alerts" | "news" | "subscribers" | "update" | "safety" | "timetable";

type Stats = {
  totalSchedules: number; onTime: number; delayed: number;
  cancelled: number; totalAlerts: number; criticalAlerts: number; totalNews: number;
  totalSubscribers: number;
};

type Subscriber = { id: string; email: string; station: string; created_at: string };
type TrainUpdateRecord = { id: string; train_no: string; line: string; station: string; status: string; delay_min: number; reason: string; updated_at: string };
type SafetyIncident = { id: string; type: string; station: string; details: string; status: string; created_at: string };

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
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, a, n, st] = await Promise.all([api.schedules(), api.alerts(), api.news(), api.stats()]);
      setSchedules(s); setAlerts(a); setNews(n); setStats(st);
      // Load subscribers and updates in background — don't block if Supabase not configured
      api.subscribers().then(setSubscribers).catch(() => {});
      api.recentUpdates().then(setUpdates).catch(() => {});
      api.adminSafetyIncidents().then(setSafetyIncidents).catch(() => {});
      api.timetable().then(setTimetableEntries).catch(() => {});
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
      {/* Sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex items-center gap-2 border-b border-border px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-primary">
            <Train className="h-5 w-5 text-primary-foreground" />
          </div>
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
        </nav>
        <div className="border-t border-border p-3 space-y-1">
          <Link to="/" className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-muted-foreground hover:bg-secondary">
            ← Public site
          </Link>
          <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-destructive hover:bg-destructive/10">
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>

      {/* Main */}
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
            <tr>
              <Th>Train</Th><Th>Route</Th><Th>Depart</Th><Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {schedules.slice(0, 5).map((s) => (
              <tr key={s.id} className="border-t border-border">
                <Td>#{s.trainNo}</Td>
                <Td>{s.from} → {s.to}</Td>
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

      {editing && (
        <ScheduleForm
          data={editing}
          onChange={setEditing}
          onSave={save}
          onCancel={() => setEditing(null)}
          isNew={isNew}
        />
      )}

      <div className="rounded-md border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
            <tr>
              <Th>Train</Th><Th>Line</Th><Th>Route</Th><Th>Depart</Th><Th>Arrive</Th><Th>Status</Th><Th>Fare</Th><th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {schedules.map((s) => (
              <tr key={s.id} className="border-t border-border hover:bg-secondary/30">
                <Td>#{s.trainNo}</Td>
                <Td>{s.line}</Td>
                <Td>{s.from} → {s.to}</Td>
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
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
          {count}
        </span>
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
        <p className="mb-4 text-sm text-muted-foreground">Subscribers at the selected station will receive an instant email notification.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Train Number" value={form.trainNo} onChange={(v) => setForm((f) => ({ ...f, trainNo: v }))} />
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Station</label>
              <select
                required
                value={form.station}
                onChange={(e) => setForm((f) => ({ ...f, station: e.target.value }))}
                className="w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select a station…</option>
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
            <textarea rows={2} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="e.g. Cable theft, signal failure, track maintenance…" className="w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {result && (
            <div className="rounded-sm bg-success/10 p-3 text-sm text-success">
              {result.message} — <strong>{result.notified}</strong> subscriber(s) notified.
            </div>
          )}
          <button type="submit" disabled={loading} className="flex items-center gap-2 rounded-sm bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-60">
            <Send className="h-4 w-4" />
            {loading ? "Sending…" : "Post update & notify subscribers"}
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
                  <p className="text-sm font-medium text-foreground">Train #{u.train_no} · {u.station} · {u.line}</p>
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
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email or station…"
          className="flex-1 rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
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
              <tr>
                <Th>Email</Th><Th>Home Station</Th><Th>Registered</Th>
              </tr>
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

// ── Safety Tab ────────────────────────────────────────────────────────────────────────────
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
      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Reports"   value={incidents.length}                                    color="bg-primary" />
        <StatCard label="Pending"         value={pending.length}                                      color="bg-destructive" />
        <StatCard label="Resolved"        value={incidents.filter((i) => i.status === "resolved").length} color="bg-success" />
      </div>

      {/* Pending banner */}
      {pending.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            <span className="font-semibold text-foreground">Pending — requires action</span>
            <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {pending.length}
            </span>
          </div>
          <div className="divide-y divide-border">
            {pending.map((inc) => (
              <div key={inc.id} className="flex items-start gap-3 px-4 py-4">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${TYPE_COLOR[inc.type] ?? ""}` }>
                      {inc.type}
                    </span>
                    <span className="text-xs text-muted-foreground">{inc.station}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(inc.created_at).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-foreground">{inc.details}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button disabled={updating === inc.id} onClick={() => updateStatus(inc.id, "in_progress")}
                    className="rounded-sm border border-warning/40 px-2 py-1 text-xs text-warning hover:bg-warning/10 disabled:opacity-50">
                    In progress
                  </button>
                  <button disabled={updating === inc.id} onClick={() => updateStatus(inc.id, "resolved")}
                    className="rounded-sm border border-success/40 px-2 py-1 text-xs text-success hover:bg-success/10 disabled:opacity-50">
                    Resolve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All incidents table */}
      <div className="rounded-md border border-border bg-card">
        <div className="border-b border-border px-4 py-3 font-semibold text-foreground">All reports</div>
        {incidents.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No safety reports yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
                <tr><Th>Type</Th><Th>Station</Th><Th>Details</Th><Th>Status</Th><Th>Reported</Th><Th /></tr>
              </thead>
              <tbody>
                {incidents.map((inc) => (
                  <tr key={inc.id} className="border-t border-border hover:bg-secondary/30">
                    <Td>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${TYPE_COLOR[inc.type] ?? "bg-secondary border-border text-foreground"}`}>
                        {inc.type}
                      </span>
                    </Td>
                    <Td>{inc.station}</Td>
                    <Td><span className="line-clamp-2 block max-w-xs text-muted-foreground">{inc.details}</span></Td>
                    <Td>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        inc.status === "resolved"    ? "bg-success/15 text-success" :
                        inc.status === "in_progress" ? "bg-warning/20 text-foreground" :
                        "bg-destructive/15 text-destructive"
                      }`}>{inc.status}</span>
                    </Td>
                    <Td>{new Date(inc.created_at).toLocaleString("en-ZA", { dateStyle: "short", timeStyle: "short" })}</Td>
                    <Td>
                      <div className="flex gap-1">
                        {inc.status !== "in_progress" && inc.status !== "resolved" && (
                          <button disabled={updating === inc.id} onClick={() => updateStatus(inc.id, "in_progress")}
                            className="rounded-sm border border-warning/40 px-2 py-1 text-xs text-warning hover:bg-warning/10 disabled:opacity-50">
                            In progress
                          </button>
                        )}
                        {inc.status !== "resolved" && (
                          <button disabled={updating === inc.id} onClick={() => updateStatus(inc.id, "resolved")}
                            className="rounded-sm border border-success/40 px-2 py-1 text-xs text-success hover:bg-success/10 disabled:opacity-50">
                            Resolve
                          </button>
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

// ── Timetable Tab — admin adds upcoming trains to DB ─────────────────────────
const BLANK_TIMETABLE = {
  train_no: "", line: "Southern Line", from_station: "", to_station: "",
  departure: "", arrival: "", platform: "", status: "On Time", fare: "",
};

function TimetableTab({ entries, onRefresh }: { entries: Record<string, unknown>[]; onRefresh: () => void }) {
  const [form, setForm] = useState({ ...BLANK_TIMETABLE });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(""); setSuccess(false);
    try {
      await api.addTimetableEntry({ ...form, fare: Number(form.fare) });
      setSuccess(true);
      setForm({ ...BLANK_TIMETABLE });
      onRefresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-border bg-card p-5">
        <h2 className="mb-1 font-semibold text-foreground">Add upcoming train to timetable</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Entries added here are stored in the database and surfaced in the Trip Planner timetable view.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Train No" value={form.train_no} onChange={(v) => set("train_no", v)} />
            <Field label="From Station" value={form.from_station} onChange={(v) => set("from_station", v)} />
            <Field label="To Station" value={form.to_station} onChange={(v) => set("to_station", v)} />
            <Field label="Departure (HH:mm)" value={form.departure} onChange={(v) => set("departure", v)} />
            <Field label="Arrival (HH:mm)" value={form.arrival} onChange={(v) => set("arrival", v)} />
            <Field label="Platform" value={form.platform} onChange={(v) => set("platform", v)} />
            <Field label="Fare (ZAR)" type="number" value={form.fare} onChange={(v) => set("fare", v)} />
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Line</label>
              <select value={form.line} onChange={(e) => set("line", e.target.value)} className="w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm text-foreground">
                {["Southern Line","Northern Line","Central Line","Cape Flats Line"].map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
              <select value={form.status} onChange={(e) => set("status", e.target.value)} className="w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm text-foreground">
                {["On Time","Delayed","Cancelled"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="rounded-sm bg-success/10 p-2 text-sm text-success">Timetable entry saved to database.</p>}
          <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60">
            <Plus className="h-4 w-4" />
            {saving ? "Saving…" : "Add to timetable"}
          </button>
        </form>
      </div>

      {entries.length > 0 && (
        <div className="rounded-md border border-border bg-card overflow-x-auto">
          <div className="border-b border-border px-4 py-3 font-semibold text-foreground">
            Stored timetable entries ({entries.length})
          </div>
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
              <tr>
                <Th>Train</Th><Th>Line</Th><Th>Route</Th><Th>Departs</Th><Th>Arrives</Th><Th>Platform</Th><Th>Status</Th><Th>Fare</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={String(e.id ?? i)} className="border-t border-border hover:bg-secondary/30">
                  <Td>#{String(e.train_no ?? "")}</Td>
                  <Td>{String(e.line ?? "")}</Td>
                  <Td>{String(e.from_station ?? "")} → {String(e.to_station ?? "")}</Td>
                  <Td>{String(e.departure ?? "")}</Td>
                  <Td>{String(e.arrival ?? "")}</Td>
                  <Td>{String(e.platform ?? "")}</Td>
                  <Td><StatusBadge status={String(e.status ?? "On Time")} /></Td>
                  <Td>R {Number(e.fare ?? 0).toFixed(2)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {entries.length === 0 && (
        <p className="rounded-md border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No timetable entries in the database yet. Use the form above to add upcoming trains.
        </p>
      )}
    </div>
  );
}

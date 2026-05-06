import { useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Chatbot } from "@/components/Chatbot";
import { NEWS, type NewsItem } from "@/data/extras";
import { api } from "@/lib/api";
import { Newspaper, Calendar, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "News & Announcements — PRASA Smart Commute" },
      { name: "description", content: "Latest PRASA press releases, network upgrades and community announcements." },
    ],
  }),
  component: NewsPage,
});

const CATEGORIES: NewsItem["category"][] = ["Network", "Upgrade", "Community", "Press"];
const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

function NewsPage() {
  const [active, setActive] = useState<NewsItem["category"] | null>(null);
  const [items, setItems] = useState<NewsItem[]>(NEWS);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.news();
      if (data && data.length > 0) setItems(data);
    } catch {
      // fallback to static data already set
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, []);

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchNews]);

  const filtered = active ? items.filter((n) => n.category === active) : items;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <section className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
                <Newspaper className="h-6 w-6 text-destructive" /> News & announcements
              </h1>
              <p className="mt-1 text-sm opacity-90">Press releases, network upgrades and community updates.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs opacity-70">
                Updated {lastRefresh.toLocaleTimeString("en-ZA", { timeStyle: "short" })}
              </span>
              <button
                onClick={fetchNews}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-sm border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto flex-1 px-4 py-8">
        <div className="mb-5 flex flex-wrap gap-2">
          <FilterChip label="All" active={!active} onClick={() => setActive(null)} />
          {CATEGORIES.map((c) => (
            <FilterChip key={c} label={c} active={active === c} onClick={() => setActive(c)} />
          ))}
        </div>

        {loading && items.length === 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-md border border-border bg-card" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((n, i) => (
              <article
                key={n.id}
                className={`rounded-md border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-elevated ${
                  i === 0 && !active ? "md:col-span-2" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-sm bg-destructive px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-destructive-foreground">
                    {n.category}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {new Date(n.date).toLocaleDateString("en-ZA", { dateStyle: "long" })}
                  </span>
                </div>
                <h2 className={`mt-2 font-bold text-foreground ${i === 0 && !active ? "text-xl md:text-2xl" : "text-base"}`}>
                  {n.title}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">{n.excerpt}</p>
                <a
                  href="https://prasa.com/news"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
                >
                  Read more on PRASA.com →
                </a>
              </article>
            ))}
          </div>
        )}
      </section>

      <Footer />
      <Chatbot />
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
        active ? "border-destructive bg-destructive text-destructive-foreground" : "border-border bg-card text-foreground hover:bg-secondary"
      }`}
    >
      {label}
    </button>
  );
}

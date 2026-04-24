import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Chatbot } from "@/components/Chatbot";
import { NEWS, type NewsItem } from "@/data/extras";
import { Newspaper, Calendar } from "lucide-react";

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

function NewsPage() {
  const [active, setActive] = useState<NewsItem["category"] | null>(null);
  const items = active ? NEWS.filter((n) => n.category === active) : NEWS;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <section className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-8">
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
            <Newspaper className="h-6 w-6 text-destructive" /> News & announcements
          </h1>
          <p className="mt-1 text-sm opacity-90">Press releases, network upgrades and community updates.</p>
        </div>
      </section>

      <section className="container mx-auto flex-1 px-4 py-8">
        <div className="mb-5 flex flex-wrap gap-2">
          <FilterChip label="All" active={!active} onClick={() => setActive(null)} />
          {CATEGORIES.map((c) => (
            <FilterChip key={c} label={c} active={active === c} onClick={() => setActive(c)} />
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {items.map((n, i) => (
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
              <button className="mt-3 text-sm font-semibold text-primary hover:underline">Read more →</button>
            </article>
          ))}
        </div>
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

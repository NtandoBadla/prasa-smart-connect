import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Chatbot } from "@/components/Chatbot";
import { useSavedRoutes } from "@/hooks/useSavedRoutes";
import { searchTrains } from "@/data/prasa";
import { Star, Trash2, ArrowRight, Bell } from "lucide-react";

export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: "My Routes — PRASA Smart Commute" },
      { name: "description", content: "Your saved Metrorail routes with personalised alerts and quick access to the next departures." },
    ],
  }),
  component: SavedPage,
});

function SavedPage() {
  const { routes, remove } = useSavedRoutes();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <section className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-8">
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
            <Star className="h-6 w-6 text-destructive" /> My saved routes
          </h1>
          <p className="mt-1 text-sm opacity-90">Quick access to your most-used trips. Saved on this device.</p>
        </div>
      </section>

      <section className="container mx-auto flex-1 px-4 py-8">
        {routes.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-card p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Star className="h-5 w-5" />
            </div>
            <h3 className="mt-3 font-semibold text-foreground">No routes saved yet</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Search for a trip and tap the star on any train to save it here for one-tap access.
            </p>
            <Link
              to="/search"
              className="mt-4 inline-flex items-center gap-2 rounded-sm bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:opacity-90"
            >
              Plan a trip <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {routes.map((r) => {
              const next = searchTrains(r.from, r.to)[0];
              return (
                <article key={`${r.from}-${r.to}`} className="rounded-md border border-border bg-card p-4 shadow-card">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold text-foreground">
                      {r.from} <span className="text-muted-foreground">→</span> {r.to}
                    </h3>
                    <button
                      onClick={() => remove(r.from, r.to)}
                      className="rounded-sm border border-border p-2 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {next ? (
                    <div className="mt-3 rounded-sm bg-secondary/50 p-3 text-sm">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Next train</div>
                      <div className="mt-1 font-semibold text-foreground">
                        {next.departure} → {next.arrival} · {next.line}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Platform {next.platform} · R {next.fare.toFixed(2)} · {next.status}
                        {next.delayMin ? ` (+${next.delayMin}m)` : ""}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">No services found for this route right now.</p>
                  )}
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Bell className="h-3.5 w-3.5 text-destructive" />
                    Alerts on for this route
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <Footer />
      <Chatbot />
    </div>
  );
}

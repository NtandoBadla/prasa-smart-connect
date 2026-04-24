import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useMemo } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AlertsBanner } from "@/components/AlertsBanner";
import { Chatbot } from "@/components/Chatbot";
import { RouteSearchForm } from "@/components/RouteSearchForm";
import { TrainCard } from "@/components/TrainCard";
import { searchTrains } from "@/data/prasa";
import { Search as SearchIcon } from "lucide-react";

const searchSchema = z.object({
  from: z.string().optional().default(""),
  to: z.string().optional().default(""),
  time: z.string().optional().default(""),
});

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Plan a Trip — PRASA Smart Commute" },
      { name: "description", content: "Search Metrorail trains between any two stations in the Western Cape. Departure, arrival, platform and fare in one view." },
      { property: "og:title", content: "Plan a Trip — PRASA" },
      { property: "og:description", content: "Search Metrorail trains between any two stations." },
    ],
  }),
  validateSearch: searchSchema,
  component: SearchPage,
});

function SearchPage() {
  const navigate = Route.useNavigate();
  const { from, to, time } = Route.useSearch();

  const results = useMemo(() => (from && to ? searchTrains(from, to, time) : []), [from, to, time]);

  const handleSearch = (f: string, t: string, ti: string) => {
    navigate({ search: { from: f, to: t, time: ti } });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <AlertsBanner />

      <section className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold md:text-3xl">Plan your trip</h1>
          <p className="mt-1 text-sm opacity-90">Find the next Metrorail train between any two stations.</p>
        </div>
      </section>

      <section className="container mx-auto -mt-6 px-4">
        <RouteSearchForm initialFrom={from} initialTo={to} initialTime={time} onSearch={handleSearch} />
      </section>

      <section className="container mx-auto flex-1 px-4 py-8">
        {!from || !to ? (
          <EmptyState
            title="Search to see trains"
            desc="Enter a departure and destination station above. Try Cape Town to Simon's Town."
          />
        ) : results.length === 0 ? (
          <EmptyState
            title="No direct trains found"
            desc={`We couldn't find a service from ${from} to ${to}${time ? ` after ${time}` : ""}. Try a different time or nearby station.`}
          />
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {results.length} train{results.length > 1 ? "s" : ""} from {from} to {to}
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {results.map((t) => (
                <TrainCard key={t.id} train={t} />
              ))}
            </div>
          </>
        )}
      </section>

      <Footer />
      <Chatbot />
    </div>
  );
}

function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-card p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <SearchIcon className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-base font-semibold text-foreground">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

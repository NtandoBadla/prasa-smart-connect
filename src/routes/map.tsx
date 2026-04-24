import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Chatbot } from "@/components/Chatbot";
import { NETWORK_LAYOUT, LINE_COLORS, LINE_PATHS } from "@/data/extras";
import { Map as MapIcon } from "lucide-react";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Network Map — PRASA Smart Commute" },
      { name: "description", content: "Interactive Cape Town Metrorail network map with all lines and stations." },
      { property: "og:title", content: "Network Map — PRASA" },
      { property: "og:description", content: "Explore the Cape Town Metrorail network." },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [activeLine, setActiveLine] = useState<string | null>(null);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <section className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-8">
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
            <MapIcon className="h-6 w-6 text-destructive" /> Network map
          </h1>
          <p className="mt-1 text-sm opacity-90">Click any station to plan a trip from there.</p>
        </div>
      </section>

      <section className="container mx-auto flex-1 px-4 py-8">
        {/* Line legend */}
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveLine(null)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              !activeLine ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-secondary"
            }`}
          >
            All lines
          </button>
          {Object.entries(LINE_COLORS).map(([line, color]) => (
            <button
              key={line}
              onClick={() => setActiveLine(line === activeLine ? null : line)}
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                activeLine === line ? "border-foreground" : "border-border hover:bg-secondary"
              }`}
              style={activeLine === line ? { backgroundColor: color, color: "white" } : {}}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
              {line}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="overflow-hidden rounded-md border border-border bg-card p-2 shadow-card">
            <svg viewBox="0 0 540 520" className="h-auto w-full">
              {/* Lines */}
              {Object.entries(LINE_PATHS).map(([line, stops]) => {
                const dim = activeLine && activeLine !== line ? 0.15 : 1;
                const points = stops.map((s) => NETWORK_LAYOUT[s]).filter(Boolean);
                if (points.length < 2) return null;
                const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
                return (
                  <path
                    key={line}
                    d={d}
                    fill="none"
                    stroke={LINE_COLORS[line]}
                    strokeWidth={5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={dim}
                  />
                );
              })}
              {/* Stations */}
              {Object.entries(NETWORK_LAYOUT).map(([name, pos]) => {
                const isInLine = !activeLine || pos.lines.includes(activeLine);
                const isHub = pos.lines.length >= 2;
                const isSel = selected === name;
                return (
                  <g
                    key={name}
                    transform={`translate(${pos.x},${pos.y})`}
                    className="cursor-pointer"
                    onClick={() => setSelected(name)}
                    opacity={isInLine ? 1 : 0.25}
                  >
                    <circle
                      r={isSel ? 9 : isHub ? 7 : 5}
                      fill={isSel ? "oklch(0.55 0.22 27)" : "white"}
                      stroke="oklch(0.18 0.04 250)"
                      strokeWidth={2.5}
                    />
                    <text
                      x={pos.x > 400 ? -10 : 12}
                      y={4}
                      textAnchor={pos.x > 400 ? "end" : "start"}
                      fontSize="10"
                      fontWeight={isHub ? 700 : 500}
                      fill="oklch(0.18 0.04 250)"
                    >
                      {name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <aside className="rounded-md border border-border bg-card p-5 shadow-card">
            {selected ? (
              <>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Station</div>
                <h2 className="mt-1 text-xl font-bold text-foreground">{selected}</h2>
                <div className="mt-3 space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lines</div>
                  <div className="flex flex-wrap gap-1.5">
                    {NETWORK_LAYOUT[selected].lines.map((l) => (
                      <span
                        key={l}
                        className="rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                        style={{ backgroundColor: LINE_COLORS[l] }}
                      >
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-5 flex flex-col gap-2">
                  <Link
                    to="/search"
                    search={{ from: selected, to: "", time: "" }}
                    className="rounded-sm bg-destructive px-3 py-2 text-center text-sm font-semibold text-destructive-foreground hover:opacity-90"
                  >
                    Plan trip from here
                  </Link>
                  <Link
                    to="/planner"
                    search={{ from: selected, to: "", time: "" }}
                    className="rounded-sm border border-border bg-background px-3 py-2 text-center text-sm font-semibold text-foreground hover:bg-secondary"
                  >
                    Trip planner with transfers
                  </Link>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select a station on the map to see details and plan a trip.</p>
            )}
          </aside>
        </div>
      </section>

      <Footer />
      <Chatbot />
    </div>
  );
}

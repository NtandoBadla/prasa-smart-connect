import { useState, useEffect, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Chatbot } from "@/components/Chatbot";
import { LINE_COLORS } from "@/data/extras";
import { Map as MapIcon } from "lucide-react";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Network Map — PRASA Smart Commute" },
      { name: "description", content: "Interactive Cape Town Metrorail network map with all lines and stations." },
    ],
  }),
  component: MapPage,
});

// Real GPS coordinates for Cape Town Metrorail stations
const STATION_COORDS: Record<string, [number, number]> = {
  "Cape Town":       [-33.9249, 18.4241],
  "Woodstock":       [-33.9280, 18.4380],
  "Salt River":      [-33.9310, 18.4620],
  "Observatory":     [-33.9380, 18.4710],
  "Mowbray":         [-33.9440, 18.4760],
  "Rondebosch":      [-33.9560, 18.4730],
  "Newlands":        [-33.9640, 18.4680],
  "Claremont":       [-33.9740, 18.4650],
  "Wynberg":         [-33.9990, 18.4640],
  "Retreat":         [-34.0380, 18.4900],
  "Muizenberg":      [-34.1060, 18.4700],
  "Fish Hoek":       [-34.1380, 18.4280],
  "Simon's Town":    [-34.1880, 18.4360],
  "Pinelands":       [-33.9380, 18.5050],
  "Goodwood":        [-33.9100, 18.5480],
  "Parow":           [-33.9040, 18.5900],
  "Bellville":       [-33.8990, 18.6290],
  "Stellenbosch":    [-33.9360, 18.8600],
  "Langa":           [-33.9490, 18.5240],
  "Nyanga":          [-33.9870, 18.5490],
  "Philippi":        [-34.0100, 18.5700],
  "Mitchells Plain": [-34.0480, 18.6150],
  "Khayelitsha":     [-34.0420, 18.6730],
};

const LINE_PATHS: Record<string, string[]> = {
  "Southern Line":   ["Cape Town","Salt River","Observatory","Mowbray","Rondebosch","Newlands","Claremont","Wynberg","Retreat","Muizenberg","Fish Hoek","Simon's Town"],
  "Northern Line":   ["Cape Town","Salt River","Pinelands","Goodwood","Parow","Bellville","Stellenbosch"],
  "Central Line":    ["Cape Town","Salt River","Langa","Nyanga","Philippi","Mitchells Plain","Khayelitsha"],
  "Cape Flats Line": ["Cape Town","Salt River","Pinelands","Nyanga","Philippi","Retreat"],
};

// Convert LINE_COLORS oklch to hex for Leaflet
const LEAFLET_LINE_COLORS: Record<string, string> = {
  "Southern Line":   "#d9534f",
  "Northern Line":   "#2c5f9e",
  "Central Line":    "#3a9e5f",
  "Cape Flats Line": "#e6a817",
};

function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<any>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [activeLine, setActiveLine] = useState<string | null>(null);
  const markersRef = useRef<Record<string, any>>({});

  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return;

    // Dynamically import Leaflet to avoid SSR issues
    import("leaflet").then((L) => {
      // Fix default icon paths
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current!, {
        center: [-33.97, 18.55],
        zoom: 11,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      leafletRef.current = { map, L, polylines: {} as Record<string, any>, markers: {} as Record<string, any> };

      // Draw lines
      Object.entries(LINE_PATHS).forEach(([line, stops]) => {
        const coords = stops.map((s) => STATION_COORDS[s]).filter(Boolean);
        const poly = L.polyline(coords, {
          color: LEAFLET_LINE_COLORS[line],
          weight: 4,
          opacity: 0.85,
        }).addTo(map);
        leafletRef.current.polylines[line] = poly;
      });

      // Draw station markers
      const stationLines: Record<string, string[]> = {};
      Object.entries(LINE_PATHS).forEach(([line, stops]) => {
        stops.forEach((s) => {
          if (!stationLines[s]) stationLines[s] = [];
          stationLines[s].push(line);
        });
      });

      Object.entries(STATION_COORDS).forEach(([name, coords]) => {
        const lines = stationLines[name] ?? [];
        const isHub = lines.length >= 2;
        const circleMarker = L.circleMarker(coords, {
          radius: isHub ? 8 : 5,
          fillColor: "white",
          color: "#1a1a2e",
          weight: 2,
          opacity: 1,
          fillOpacity: 1,
        })
          .addTo(map)
          .bindTooltip(name, { permanent: false, direction: "top" });

        circleMarker.on("click", () => {
          setSelected(name);
        });

        leafletRef.current.markers[name] = circleMarker;
        markersRef.current[name] = circleMarker;
      });
    });

    return () => {
      if (leafletRef.current?.map) {
        leafletRef.current.map.remove();
        leafletRef.current = null;
      }
    };
  }, []);

  // Highlight selected station
  useEffect(() => {
    if (!leafletRef.current) return;
    const { L, markers } = leafletRef.current;
    Object.entries(markers).forEach(([name, marker]: [string, any]) => {
      marker.setStyle({
        fillColor: name === selected ? LEAFLET_LINE_COLORS["Southern Line"] : "white",
        radius: name === selected ? 10 : (Object.values(LINE_PATHS).filter((s) => s.includes(name)).length >= 2 ? 8 : 5),
      });
    });
  }, [selected]);

  // Dim/highlight lines by active filter
  useEffect(() => {
    if (!leafletRef.current) return;
    const { polylines } = leafletRef.current;
    Object.entries(polylines).forEach(([line, poly]: [string, any]) => {
      poly.setStyle({ opacity: !activeLine || activeLine === line ? 0.85 : 0.15 });
    });
  }, [activeLine]);

  const selectedLines = selected
    ? Object.entries(LINE_PATHS)
        .filter(([, stops]) => stops.includes(selected))
        .map(([line]) => line)
    : [];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      {/* Leaflet CSS */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

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
          {Object.entries(LEAFLET_LINE_COLORS).map(([line, color]) => (
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

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* Leaflet Map */}
          <div
            ref={mapRef}
            className="h-[500px] overflow-hidden rounded-md border border-border shadow-card"
            style={{ zIndex: 0 }}
          />

          {/* Station detail panel */}
          <aside className="rounded-md border border-border bg-card p-5 shadow-card">
            {selected ? (
              <>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Station</div>
                <h2 className="mt-1 text-xl font-bold text-foreground">{selected}</h2>
                <div className="mt-3 space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lines</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedLines.map((l) => (
                      <span
                        key={l}
                        className="rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                        style={{ backgroundColor: LEAFLET_LINE_COLORS[l] }}
                      >
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
                {STATION_COORDS[selected] && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    {STATION_COORDS[selected][0].toFixed(4)}°S, {STATION_COORDS[selected][1].toFixed(4)}°E
                  </div>
                )}
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
              <p className="text-sm text-muted-foreground">Click a station on the map to see details and plan a trip.</p>
            )}
          </aside>
        </div>
      </section>

      <Footer />
      <Chatbot />
    </div>
  );
}

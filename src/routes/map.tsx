import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { STATIONS, STATION_COORDS } from "@/data/prasa";
import mapStyle from "@/lib/mapStyles";

export const Route = createFileRoute("/map")({
  component: MapPage,
});

type RiskLevel = "High Risk" | "Moderate" | "Safe";

const RISK_COLOR: Record<RiskLevel, string> = {
  "High Risk": "#ef4444",
  "Moderate":  "#f97316",
  "Safe":      "#22c55e",
};

function calcScore(avgVader: number, negPct: number, incidentCount: number) {
  const s = Math.max(0, (1 - avgVader) / 2) * 0.4 + (negPct / 100) * 0.3 + Math.min(1, incidentCount / 5) * 0.3;
  return s;
}

function riskLevel(score: number, incidents: number): RiskLevel {
  if (score >= 0.55 || incidents >= 3) return "High Risk";
  if (score >= 0.35 || incidents >= 1) return "Moderate";
  return "Safe";
}

function MapPage() {
  const mapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const loadMap = async () => {
      if (!window.google) {
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
        await new Promise((resolve) => { script.onload = resolve; });
      }

      const map = new window.google.maps.Map(mapRef.current!, {
        center: { lat: -33.9249, lng: 18.4241 },
        zoom: 11,
        mapTypeControl: false,
        styles: mapStyle,
      });

      new window.google.maps.TransitLayer().setMap(map);

      // Load hotspot data and place color-coded markers
      try {
        const { feedback, incidents } = await api.hotspotData();

        // Aggregate sentiment per station
        const sentMap: Record<string, { compounds: number[]; negCount: number; total: number }> = {};
        feedback.forEach((f) => {
          [f.from_station, f.to_station].filter(Boolean).forEach((st) => {
            if (!sentMap[st]) sentMap[st] = { compounds: [], negCount: 0, total: 0 };
            sentMap[st].compounds.push(f.vader_compound);
            sentMap[st].total += 1;
            if (f.hf_label === "negative" && f.hf_confidence > 0.5 || f.vader_compound < -0.05)
              sentMap[st].negCount += 1;
          });
        });

        const incMap: Record<string, number> = {};
        incidents.forEach((i) => { incMap[i.station] = (incMap[i.station] ?? 0) + 1; });

        const infoWindow = new window.google.maps.InfoWindow();

        STATIONS.forEach((station) => {
          const coords = STATION_COORDS[station];
          if (!coords) return;

          const sa = sentMap[station];
          const feedbackCount = sa?.total ?? 0;
          const avgVader = sa && sa.compounds.length > 0
            ? sa.compounds.reduce((a, b) => a + b, 0) / sa.compounds.length
            : 0.1;
          const negPct = feedbackCount > 0 ? (sa.negCount / feedbackCount) * 100 : 0;
          const incidentCount = incMap[station] ?? 0;
          const score = calcScore(avgVader, negPct, incidentCount);
          const risk = riskLevel(score, incidentCount);
          const color = RISK_COLOR[risk];

          const marker = new window.google.maps.Marker({
            map,
            position: coords,
            title: station,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: color,
              fillOpacity: 0.9,
              strokeColor: "#fff",
              strokeWeight: 2,
            },
          });

          marker.addListener("click", () => {
            infoWindow.setContent(`
              <div style="font-family:sans-serif;min-width:160px">
                <strong style="font-size:14px">${station}</strong><br/>
                <span style="display:inline-block;margin-top:4px;padding:2px 8px;border-radius:9999px;background:${color};color:#fff;font-size:11px;font-weight:600">${risk}</span>
                <div style="margin-top:6px;font-size:12px;color:#555">
                  Feedback: <b>${feedbackCount}</b> &nbsp;|&nbsp; Incidents: <b>${incidentCount}</b><br/>
                  Neg. feedback: <b>${negPct.toFixed(0)}%</b> &nbsp;|&nbsp; VADER: <b>${avgVader >= 0 ? "+" : ""}${avgVader.toFixed(2)}</b>
                </div>
              </div>
            `);
            infoWindow.open(map, marker);
          });
        });

        // Legend overlay
        const legend = document.createElement("div");
        legend.style.cssText = "background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.25);padding:10px 14px;margin:10px;font-family:sans-serif;font-size:12px;line-height:1.8";
        legend.innerHTML = `
          <strong style="display:block;margin-bottom:4px;font-size:13px">Crime Hotspots</strong>
          <div><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#ef4444;margin-right:6px;vertical-align:middle"></span>High Risk</div>
          <div><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#f97316;margin-right:6px;vertical-align:middle"></span>Moderate</div>
          <div><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#22c55e;margin-right:6px;vertical-align:middle"></span>Safe</div>
        `;
        map.controls[window.google.maps.ControlPosition.LEFT_BOTTOM].push(legend);
      } catch {
        // Silently skip hotspot overlay if API unavailable
      }
    };

    loadMap();
  }, []);

  return <div ref={mapRef} className="h-screen w-full" style={{ zIndex: 0 }} />;
}

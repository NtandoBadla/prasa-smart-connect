import { useEffect, useState, useCallback } from "react";

export interface SavedRoute {
  from: string;
  to: string;
  savedAt: string;
}

const KEY = "prasa.savedRoutes";

function read(): SavedRoute[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function useSavedRoutes() {
  const [routes, setRoutes] = useState<SavedRoute[]>([]);

  useEffect(() => {
    setRoutes(read());
    const onStorage = () => setRoutes(read());
    window.addEventListener("storage", onStorage);
    window.addEventListener("prasa:saved-changed", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("prasa:saved-changed", onStorage);
    };
  }, []);

  const persist = (next: SavedRoute[]) => {
    localStorage.setItem(KEY, JSON.stringify(next));
    setRoutes(next);
    window.dispatchEvent(new Event("prasa:saved-changed"));
  };

  const isSaved = useCallback(
    (from: string, to: string) =>
      routes.some((r) => r.from.toLowerCase() === from.toLowerCase() && r.to.toLowerCase() === to.toLowerCase()),
    [routes],
  );

  const toggle = useCallback(
    (from: string, to: string) => {
      const exists = routes.some(
        (r) => r.from.toLowerCase() === from.toLowerCase() && r.to.toLowerCase() === to.toLowerCase(),
      );
      const next = exists
        ? routes.filter((r) => !(r.from.toLowerCase() === from.toLowerCase() && r.to.toLowerCase() === to.toLowerCase()))
        : [...routes, { from, to, savedAt: new Date().toISOString() }];
      persist(next);
    },
    [routes],
  );

  const remove = useCallback(
    (from: string, to: string) => {
      persist(
        routes.filter(
          (r) => !(r.from.toLowerCase() === from.toLowerCase() && r.to.toLowerCase() === to.toLowerCase()),
        ),
      );
    },
    [routes],
  );

  return { routes, isSaved, toggle, remove };
}

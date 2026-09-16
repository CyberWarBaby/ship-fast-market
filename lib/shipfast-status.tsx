"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { shipfast } from "./shipfast";

interface ShipFastStatusValue {
  online: boolean;
  checking: boolean;
  error: string | null;
  refresh: () => Promise<boolean>;
}

const ShipFastStatusContext = createContext<ShipFastStatusValue | null>(null);

export function ShipFastStatusProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      const res = await shipfast.health();
      const ok = res.status === "healthy";
      setOnline(ok);
      setError(ok ? null : "ShipFast API did not report healthy.");
      return ok;
    } catch {
      setOnline(false);
      setError(
        "Cannot reach the ShipFast API. Orders, shipping and tracking are unavailable."
      );
      return false;
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      void refresh();
    }, 15000);
    return () => window.clearInterval(id);
  }, [refresh]);

  return (
    <ShipFastStatusContext.Provider value={{ online, checking, error, refresh }}>
      {children}
    </ShipFastStatusContext.Provider>
  );
}

export function useShipFastStatus(): ShipFastStatusValue {
  const ctx = useContext(ShipFastStatusContext);
  if (!ctx) {
    throw new Error("useShipFastStatus must be used within ShipFastStatusProvider");
  }
  return ctx;
}

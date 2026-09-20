"use client";

import { useEffect } from "react";
import { useConnection } from "wagmi";
import { hydrateSettings, useGameStore } from "@/store/gameStore";

/**
 * Mounted once in the providers: loads display settings, mirrors the connected
 * wallet into the store, and keeps the chain snapshot fresh (every 6 s, and on focus).
 */
export function GameRuntime() {
  const { address } = useConnection();
  const setAddress = useGameStore((s) => s.setAddress);
  const refresh = useGameStore((s) => s.refresh);

  useEffect(() => {
    hydrateSettings();
  }, []);

  useEffect(() => {
    setAddress(address ?? null);
  }, [address, setAddress]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 6000);
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return null;
}

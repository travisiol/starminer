"use client";

import { useSyncExternalStore } from "react";

export type Toast = { id: number; kind: "info" | "error" | "success"; title: string; body?: string; ttl: number };

let toasts: Toast[] = [];
let seq = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Quiet notices — never a browser alert(). */
export function toast(input: Omit<Toast, "id" | "ttl"> & { ttl?: number }): number {
  const id = seq++;
  const t: Toast = { ttl: input.kind === "error" ? 8000 : 3500, ...input, id };
  toasts = [...toasts, t].slice(-4);
  emit();
  window.setTimeout(() => dismiss(id), t.ttl);
  return id;
}

export function dismiss(id: number) {
  if (!toasts.some((t) => t.id === id)) return;
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const empty: Toast[] = [];
export const useToasts = () =>
  useSyncExternalStore(
    subscribe,
    () => toasts,
    () => empty,
  );

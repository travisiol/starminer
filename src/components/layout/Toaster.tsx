"use client";

import { AnimatePresence, motion } from "framer-motion";
import { dismiss, useToasts } from "@/lib/toast";
import { easeOutExpo } from "@/lib/motion";

export function Toaster() {
  const toasts = useToasts();
  return (
    <div className="pointer-events-none fixed right-4 bottom-20 z-[120] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2 md:bottom-6">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.35, ease: easeOutExpo }}
            className={`glass pointer-events-auto flex items-start gap-3 px-4 py-3 ${t.kind === "error" ? "border-danger/40" : t.kind === "success" ? "border-easy/40" : ""}`}
            role="status"
          >
            <span className={`mt-1.5 dot ${t.kind === "error" ? "text-danger" : t.kind === "success" ? "text-easy" : "text-accent"}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.body ? <p className="mt-0.5 text-xs text-muted">{t.body}</p> : null}
            </div>
            <button type="button" onClick={() => dismiss(t.id)} className="label hover:text-text">
              ×
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

export type ToastKind = "success" | "error";
type ToastMsg = { id: number; text: string; kind: ToastKind };

let listeners: Array<(t: ToastMsg) => void> = [];
let nextId = 1;

/** Fire a toast from anywhere (no provider/prop-drilling needed). */
export function toast(text: string, kind: ToastKind = "success") {
  const msg: ToastMsg = { id: nextId++, text, kind };
  for (const l of listeners) l(msg);
}

const AUTO_DISMISS_MS = 4500;

/** Mounted once in the dashboard layout; renders the toast stack. */
export function ToastHost() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  useEffect(() => {
    const onToast = (t: ToastMsg) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), AUTO_DISMISS_MS);
    };
    listeners.push(onToast);
    return () => {
      listeners = listeners.filter((l) => l !== onToast);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 shadow-modal text-[13px] bg-white ${
            t.kind === "error"
              ? "border-red-200 text-red-700"
              : "border-emerald-200 text-emerald-800"
          }`}
        >
          {t.kind === "error" ? (
            <XCircle size={15} className="shrink-0 mt-0.5 text-red-500" />
          ) : (
            <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-500" />
          )}
          <span className="min-w-0">{t.text}</span>
          <button
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            aria-label="Dismiss"
            className="ml-auto shrink-0 text-slate-400 hover:text-slate-600"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

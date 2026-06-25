"use client";

import { ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  width = "max-w-lg",
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm px-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className={`w-full ${width} rounded-2xl bg-card shadow-[0_24px_64px_rgba(15,10,46,0.25)] animate-fade-in-up border border-line`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with gradient accent bar */}
        <div className="h-1 rounded-t-2xl bg-brand-gradient" />
        <div className="flex items-start justify-between border-b border-line px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-ink">{title}</h2>
            {description && (
              <p className="mt-1 text-sm text-muted">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-xl p-1.5 text-muted hover:bg-canvas hover:text-ink transition-all"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-semibold text-ink">{label}</span>
      {children}
    </label>
  );
}

export const inputClasses =
  "w-full rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/50 focus:border-brand-purple focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-purple/20 transition-all";

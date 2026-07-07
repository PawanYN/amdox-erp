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
  hideHeader = false,
  flush = false,
  ariaLabel,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
  hideHeader?: boolean;
  flush?: boolean;
  ariaLabel?: string;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] px-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? title}
      onClick={onClose}
    >
      <div
        className={`w-full ${width} rounded-xl bg-white shadow-modal border border-slate-200 overflow-hidden animate-fade-in-up`}
        onClick={(e) => e.stopPropagation()}
      >
        {!hideHeader && (
          <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
              {description && <p className="mt-0.5 text-[13px] text-slate-500">{description}</p>}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="h-7 w-7 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-600 transition-colors ml-3 shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className={flush ? "" : "px-5 py-4"}>{children}</div>
      </div>
    </div>
  );
}

export function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-slate-600">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

export const inputClasses = "input-base";

export const selectClasses = "input-base cursor-pointer";

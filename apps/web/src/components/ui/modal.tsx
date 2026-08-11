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
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.40)",
        backdropFilter: "blur(2px)",
        padding: "16px",
        animation: "fadeIn 0.2s ease-in-out"
      }}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? title}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: width === "max-w-lg" ? "512px" : width === "max-w-md" ? "448px" : width === "max-w-xl" ? "672px" : "512px",
          borderRadius: "12px",
          backgroundColor: "#ffffff",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.10), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          border: "1px solid #dfe3e8",
          overflow: "hidden",
          animation: "fadeInUp 0.3s ease-out"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {!hideHeader && (
          <div style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            borderBottom: "1px solid #dfe3e8",
            padding: "20px"
          }}>
            <div>
              <h2 style={{
                fontSize: "15px",
                fontWeight: 600,
                color: "#2b2f36",
                margin: 0
              }}>{title}</h2>
              {description && <p style={{
                marginTop: "4px",
                fontSize: "13px",
                color: "#6b7280",
                margin: 0
              }}>{description}</p>}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                width: "28px",
                height: "28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "6px",
                color: "#6b7280",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                transition: "all 0.15s ease",
                marginLeft: "12px",
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f4f6f8";
                e.currentTarget.style.color = "#2b2f36";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "#6b7280";
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div style={{
          padding: flush ? "0" : "20px"
        }}>{children}</div>
      </div>
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
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
    <label style={{ display: "block" }}>
      <span style={{
        marginBottom: "4px",
        display: "block",
        fontSize: "12px",
        fontWeight: 500,
        color: "#2b2f36"
      }}>
        {label}
        {required && <span style={{ color: "#dc2626", marginLeft: "2px" }}>*</span>}
      </span>
      {children}
    </label>
  );
}

export const inputClasses = "input-base";

export const selectClasses = "input-base cursor-pointer";

import { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "success" | "danger" | "ghost" | "outline";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-brand-purple to-brand-violet text-white hover:from-brand-violet hover:to-brand-purple shadow-[0_2px_12px_rgba(108,71,255,0.4)] hover:shadow-[0_4px_20px_rgba(108,71,255,0.55)] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none",
  success:
    "bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-400 hover:to-teal-400 shadow-[0_2px_12px_rgba(16,185,129,0.35)] hover:shadow-[0_4px_20px_rgba(16,185,129,0.5)] hover:-translate-y-0.5 disabled:opacity-50",
  danger:
    "bg-white text-accent-red border border-red-200 hover:bg-red-50 hover:border-red-300 hover:-translate-y-0.5 shadow-sm hover:shadow disabled:opacity-50",
  ghost:
    "bg-transparent text-muted hover:bg-canvas hover:text-ink disabled:opacity-50",
  outline:
    "bg-white text-ink border border-line hover:border-brand-purple/40 hover:text-brand-purple hover:-translate-y-0.5 shadow-sm hover:shadow disabled:opacity-50",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
}

export function Button({
  variant = "primary",
  icon,
  children,
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-95 ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

import { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "success" | "danger" | "ghost" | "outline" | "secondary";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-blue-700 text-white hover:bg-blue-800 active:bg-blue-900 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed",
  secondary:
    "bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed",
  success:
    "bg-green-600 text-white hover:bg-green-700 active:bg-green-800 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed",
  danger:
    "bg-white text-red-600 border border-red-200 hover:bg-red-50 hover:border-red-300 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed",
  ghost:
    "text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed",
  outline:
    "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES: Record<string, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5 rounded-md",
  md: "px-3.5 py-2 text-[13px] gap-2 rounded-md",
  lg: "px-4 py-2.5 text-sm gap-2 rounded-lg",
};

export function Button({
  variant = "primary",
  icon,
  children,
  className = "",
  size = "md",
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center font-medium transition-colors duration-150 ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

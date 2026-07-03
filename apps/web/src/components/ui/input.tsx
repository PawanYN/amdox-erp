import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", ...rest }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-[12px] font-medium text-slate-600">{label}</label>
        )}
        <input
          ref={ref}
          className={`input-base ${error ? "border-red-400 focus:border-red-400 focus:ring-red-100" : ""} ${className}`}
          {...rest}
        />
        {error && <p className="text-[11px] text-red-500">{error}</p>}
      </div>
    );
  },
);
Input.displayName = "Input";

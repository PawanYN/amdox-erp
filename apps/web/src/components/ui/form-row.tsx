import React, { ReactNode } from "react";

interface FormRowProps {
  label: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function FormRow({ label, required = false, children, className = "" }: FormRowProps) {
  return (
    <div className={`form-row ${className}`} style={{paddingLeft: 0, paddingRight: 0}}>
      <label style={{ fontSize: "13px", color: "#2b2f36", fontWeight: 500 }}>
        {label}
        {required && <span className="req" style={{color: '#d0392b', marginLeft: '2px'}}>*</span>}
      </label>
      <div>{children}</div>
    </div>
  );
}

export function FormInput({
  type = "text",
  placeholder = "",
  value,
  onChange,
  onBlur,
  disabled = false,
  maxLength,
  min,
  max,
  step,
}: {
  type?: string;
  placeholder?: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  maxLength?: number;
  min?: string | number;
  max?: string | number;
  step?: string | number;
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      disabled={disabled}
      maxLength={maxLength}
      min={min}
      max={max}
      step={step}
      style={{
        width: "100%",
        maxWidth: "340px",
        padding: "7px 10px",
        border: "1px solid #dfe3e8",
        borderRadius: "4px",
        fontSize: "13px",
        fontFamily: "inherit",
        color: "#2b2f36",
        background: disabled ? "#f4f6f8" : "#fff",
        transition: "border-color 0.15s ease",
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "#1f5fa8"; e.currentTarget.style.boxShadow = "0 0 0 3px rgb(31 95 168 / 0.10)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "#dfe3e8"; e.currentTarget.style.boxShadow = "none"; onBlur?.(e); }}
    />
  );
}

export function FormSelect({
  value,
  onChange,
  onBlur,
  disabled = false,
  children,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      disabled={disabled}
      style={{
        width: "100%",
        maxWidth: "340px",
        padding: "7px 10px",
        border: "1px solid #dfe3e8",
        borderRadius: "4px",
        fontSize: "13px",
        fontFamily: "inherit",
        color: "#2b2f36",
        background: disabled ? "#f4f6f8" : "#fff",
        transition: "border-color 0.15s ease",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "#1f5fa8"; e.currentTarget.style.boxShadow = "0 0 0 3px rgb(31 95 168 / 0.10)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "#dfe3e8"; e.currentTarget.style.boxShadow = "none"; onBlur?.(e); }}
    >
      {children}
    </select>
  );
}

export function FormTextarea({
  placeholder = "",
  value,
  onChange,
  onBlur,
  disabled = false,
  rows = 3,
}: {
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  disabled?: boolean;
  rows?: number;
}) {
  return (
    <textarea
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      disabled={disabled}
      rows={rows}
      style={{
        width: "100%",
        maxWidth: "340px",
        padding: "7px 10px",
        border: "1px solid #dfe3e8",
        borderRadius: "4px",
        fontSize: "13px",
        fontFamily: "inherit",
        color: "#2b2f36",
        background: disabled ? "#f4f6f8" : "#fff",
        transition: "border-color 0.15s ease",
        resize: "vertical",
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "#1f5fa8"; e.currentTarget.style.boxShadow = "0 0 0 3px rgb(31 95 168 / 0.10)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "#dfe3e8"; e.currentTarget.style.boxShadow = "none"; onBlur?.(e); }}
    />
  );
}

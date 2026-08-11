import React, { ReactNode } from "react";

interface FormRowProps {
  label?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
  columns?: number;
  style?: React.CSSProperties;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "340px",
  padding: "7px 10px",
  border: "1px solid #dfe3e8",
  borderRadius: "4px",
  fontSize: "13px",
  fontFamily: "inherit",
  color: "#2b2f36",
  background: "#fff",
  transition: "border-color 0.15s ease",
};

function focusInput(
  e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
) {
  e.currentTarget.style.borderColor = "#1f5fa8";
  e.currentTarget.style.boxShadow = "0 0 0 3px rgb(31 95 168 / 0.10)";
}

function blurInputElement(
  e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
) {
  e.currentTarget.style.borderColor = "#dfe3e8";
  e.currentTarget.style.boxShadow = "none";
}

export function FormRow({
  label,
  required = false,
  children,
  className = "",
  columns,
  style,
}: FormRowProps) {
  if (columns !== undefined) {
    return (
      <div
        className={className}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: "14px",
          ...style,
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <div className={`form-row ${className}`} style={{ paddingLeft: 0, paddingRight: 0, ...style }}>
      <label style={{ fontSize: "13px", color: "#2b2f36", fontWeight: 500 }}>
        {label}
        {required && (
          <span className="req" style={{ color: "#d0392b", marginLeft: "2px" }}>
            *
          </span>
        )}
      </label>
      <div>{children}</div>
    </div>
  );
}

type FormInputProps = {
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
  label?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
};

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
  label,
  required = false,
  error,
  helperText,
}: FormInputProps) {
  const field = (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled}
      maxLength={maxLength}
      min={min}
      max={max}
      step={step}
      style={{
        ...inputStyle,
        maxWidth: label ? "100%" : inputStyle.maxWidth,
        background: disabled ? "#f4f6f8" : "#fff",
        borderColor: error ? "#d0392b" : "#dfe3e8",
      }}
      onFocus={focusInput}
      onBlur={(e) => {
        blurInputElement(e);
        onBlur?.(e);
      }}
    />
  );

  if (!label) return field;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={{ fontSize: "12px", fontWeight: 600, color: "#2b2f36" }}>
        {label}
        {required && <span style={{ color: "#d0392b", marginLeft: "2px" }}>*</span>}
      </label>
      {field}
      {error ? (
        <span style={{ fontSize: "11px", color: "#d0392b" }}>{error}</span>
      ) : helperText ? (
        <span style={{ fontSize: "11px", color: "#6b7280" }}>{helperText}</span>
      ) : null}
    </div>
  );
}

type FormSelectProps = {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  children?: ReactNode;
  label?: string;
  required?: boolean;
  error?: string;
  options?: Array<{ value: string; label: string }>;
};

export function FormSelect({
  value,
  onChange,
  onBlur,
  disabled = false,
  children,
  label,
  required = false,
  error,
  options,
}: FormSelectProps) {
  const field = (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      style={{
        ...inputStyle,
        maxWidth: label ? "100%" : inputStyle.maxWidth,
        background: disabled ? "#f4f6f8" : "#fff",
        borderColor: error ? "#d0392b" : "#dfe3e8",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      onFocus={focusInput}
      onBlur={(e) => {
        blurInputElement(e);
        onBlur?.(e);
      }}
    >
      {options
        ? options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))
        : children}
    </select>
  );

  if (!label) return field;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={{ fontSize: "12px", fontWeight: 600, color: "#2b2f36" }}>
        {label}
        {required && <span style={{ color: "#d0392b", marginLeft: "2px" }}>*</span>}
      </label>
      {field}
      {error ? <span style={{ fontSize: "11px", color: "#d0392b" }}>{error}</span> : null}
    </div>
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
      disabled={disabled}
      rows={rows}
      style={{
        ...inputStyle,
        background: disabled ? "#f4f6f8" : "#fff",
        resize: "vertical",
      }}
      onFocus={focusInput}
      onBlur={(e) => {
        blurInputElement(e);
        onBlur?.(e);
      }}
    />
  );
}

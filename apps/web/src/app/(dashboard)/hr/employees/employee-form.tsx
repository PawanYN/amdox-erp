"use client";

import { FormEvent, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FormRow, FormInput, FormSelect } from "@/components/ui/form-row";
import { Employee, NewEmployeeInput } from "@/lib/types/hr";
import { X } from "lucide-react";
import { MODULE_OPTIONS, modulesForDepartment, type ErpModule } from "@/lib/erp-modules";

// Sankirtan Design System Colors
const COLORS = {
  primaryBlue: "#1f5fa8",
  text: "#2b2f36",
  muted: "#6b7280",
  borders: "#dfe3e8",
  pageBg: "#f4f6f8",
  cardBg: "#ffffff",
  error: "#dc2626",
  success: "#059669",
  successLight: "#ecfdf5",
  errorLight: "#fef2f2",
};

const STEPS = [
  { id: 1, label: "Personal Info", desc: "Basic details" },
  { id: 2, label: "Job Details", desc: "Role & contract" },
  { id: 3, label: "System Access", desc: "ERP login" },
];

const ROLES = ["Employee", "Manager", "Viewer", "TenantAdmin"] as const;

function suggestSystemRole(designation: string): (typeof ROLES)[number] {
  const d = designation.toLowerCase();
  if (d.includes("administrator") || d.includes("tenant admin")) return "TenantAdmin";
  if (d.includes("manager")) return "Manager";
  return "Employee";
}

type DepartmentOption = { id: string; name: string; code?: string; allowedModules?: string[] };

function defaultModulesForDepartment(
  departmentId: string,
  departments: DepartmentOption[],
): ErpModule[] {
  const dept = departments.find((d) => String(d.id) === String(departmentId));
  if (!dept) return [];
  return modulesForDepartment(dept.code || "", dept.allowedModules);
}

export function EmployeeForm({
  onClose,
  managers,
  departments,
  editEmployee,
  onCreate,
  onUpdate,
  loading = false,
}: {
  onClose: () => void;
  managers: Employee[];
  departments: DepartmentOption[];
  editEmployee?: Employee | null;
  onCreate: (employee: NewEmployeeInput) => void;
  onUpdate?: (id: string, employee: NewEmployeeInput) => void;
  loading?: boolean;
}) {
  const isEdit = Boolean(editEmployee);
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [data, setData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dob: "",
    code: "",
    hireDate: "",
    departmentId: "",
    managerId: "",
    designation: "",
    employmentType: "Full-time" as Employee["contractType"],
    salary: "",
    needsAccess: true,
    role: "",
    allowedModules: [] as ErpModule[],
  });

  useEffect(() => {
    if (editEmployee) {
      const parts = editEmployee.name.trim().split(" ");
      const resolvedDeptId =
        editEmployee.departmentId ||
        departments.find((d) => d.name === editEmployee.department)?.id ||
        "";
      setData({
        firstName: parts[0] || "",
        lastName: parts.slice(1).join(" ") || "",
        email: editEmployee.email,
        phone: editEmployee.phone,
        dob: editEmployee.dateOfBirth || "",
        code: "",
        hireDate: editEmployee.startDate,
        departmentId: resolvedDeptId,
        managerId: editEmployee.reportsToId || "",
        designation: editEmployee.designation || "",
        employmentType: editEmployee.contractType,
        salary: editEmployee.salary != null ? String(editEmployee.salary) : "",
        needsAccess: false,
        role: "",
        allowedModules: [] as ErpModule[],
      });
      setStep(1);
      setErrors({});
    } else {
      reset();
    }
  }, [editEmployee, departments]);

  function reset() {
    setStep(1);
    setErrors({});
    setData({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      dob: "",
      code: "",
      hireDate: "",
      departmentId: "",
      managerId: "",
      designation: "",
      employmentType: "Full-time",
      salary: "",
      needsAccess: true,
      role: "",
      allowedModules: [] as ErpModule[],
    });
  }

  function handleNext() {
    const newErrors: Record<string, string> = {};
    if (step === 1) {
      if (!data.firstName.trim()) {
        newErrors.firstName = "First name is required";
      }
      if (!data.lastName.trim()) {
        newErrors.lastName = "Last name is required";
      }
      if (!data.email.trim()) {
        newErrors.email = "Email is required";
      } else if (!/\S+@\S+\.\S+/.test(data.email)) {
        newErrors.email = "Please enter a valid email address";
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }
    } else if (step === 2) {
      if (!data.hireDate) {
        newErrors.hireDate = "Hire date is required";
      }
      if (!data.departmentId) {
        newErrors.departmentId = "Department is required";
      }
      if (data.salary && (Number.isNaN(Number(data.salary)) || Number(data.salary) < 0)) {
        newErrors.salary = "Enter a valid monthly salary";
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      const suggested = suggestSystemRole(data.designation);
      const deptModules = defaultModulesForDepartment(data.departmentId, departments);
      const suggestedRole = data.role || suggested;
      setData((prev) => ({
        ...prev,
        needsAccess: true,
        role: suggestedRole,
        allowedModules:
          suggestedRole === "TenantAdmin"
            ? MODULE_OPTIONS.map((m) => m.id)
            : prev.allowedModules.length > 0
              ? prev.allowedModules
              : deptModules,
      }));
    }
    setErrors({});
    setStep((s) => Math.min(3, s + 1));
  }

  function handleBack() {
    setErrors({});
    setStep((s) => Math.max(1, s - 1));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (data.needsAccess && !data.role) {
      setErrors({ role: "Role is required when ERP login is enabled" });
      return;
    }

    if (data.needsAccess && data.role !== "TenantAdmin" && data.allowedModules.length === 0) {
      setErrors({ allowedModules: "Select at least one ERP module tab" });
      return;
    }

    const payload: NewEmployeeInput = {
      name: `${data.firstName} ${data.lastName}`.trim(),
      email: data.email,
      phone: data.phone,
      department: data.departmentId,
      designation: data.designation || "",
      contractType: data.employmentType,
      startDate: data.hireDate,
      reportsToId: data.managerId || null,
      dateOfBirth: data.dob || undefined,
      salary: data.salary ? Number(data.salary) : undefined,
      currencyCode: data.salary ? "INR" : undefined,
      provideErpAccess: data.needsAccess,
      systemRole: data.needsAccess ? (data.role as NewEmployeeInput["systemRole"]) : undefined,
      allowedModules: data.needsAccess ? data.allowedModules : undefined,
    };

    if (isEdit && editEmployee && onUpdate) {
      onUpdate(editEmployee.id, payload);
    } else {
      onCreate(payload);
    }
    reset();
    onClose();
  }

  const getInitials = () => {
    const f = data.firstName.trim();
    const l = data.lastName.trim();
    if (!f && !l) return "EE";
    if (f && !l) return f.substring(0, 2).toUpperCase();
    if (!f && l) return l.substring(0, 2).toUpperCase();
    return `${f.charAt(0)}${l.charAt(0)}`.toUpperCase();
  };

  const initials = getInitials();
  const nameDisplay =
    `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Add Employee Details";
  const emailDisplay = data.email || "No email provided";
  const deptName =
    departments.find((d) => String(d.id) === String(data.departmentId))?.name || "Not assigned";
  const managerName =
    managers.find((m) => String(m.id) === String(data.managerId))?.name || "Not assigned";
  const moduleLabels =
    data.allowedModules.length > 0
      ? data.allowedModules
          .map((id) => MODULE_OPTIONS.find((m) => m.id === id)?.label || id)
          .join(", ")
      : "Inherit from department";

  function toggleModule(mod: ErpModule) {
    if (data.role === "TenantAdmin") return;
    setData((prev) => ({
      ...prev,
      allowedModules: prev.allowedModules.includes(mod)
        ? prev.allowedModules.filter((m) => m !== mod)
        : [...prev.allowedModules, mod],
    }));
    if (errors.allowedModules) setErrors((prev) => ({ ...prev, allowedModules: "" }));
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: COLORS.cardBg,
        width: "100%",
        maxWidth: "1000px",
        margin: "0 auto",
        borderRadius: "16px",
        border: `1px solid ${COLORS.borders}`,
        boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "relative",
          backgroundColor: COLORS.primaryBlue,
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          zIndex: 20,
          width: "100%",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-48px",
            right: "-48px",
            width: "192px",
            height: "192px",
            borderRadius: "50%",
            backgroundColor: "rgba(255,255,255,0.1)",
            filter: "blur(56px)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <nav
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: "9px",
              fontWeight: "bold",
              color: "rgba(255,255,255,0.8)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              gap: "4px",
            }}
          >
            <span>HR</span>
            <span style={{ opacity: 0.4 }}>/</span>
            <span>Employees</span>
            <span style={{ opacity: 0.4 }}>/</span>
            <span style={{ color: "white" }}>{isEdit ? "Edit Employee" : "Add Employee"}</span>
          </nav>
          <h2
            style={{
              fontSize: "16px",
              fontWeight: "800",
              color: "white",
              marginTop: "2px",
              letterSpacing: "-0.01em",
              textTransform: "uppercase",
              lineHeight: 1,
            }}
          >
            {isEdit ? "Update Employee Profile" : "Create Employee Profile"}
          </h2>
        </div>

        <button
          onClick={handleClose}
          type="button"
          style={{
            position: "relative",
            zIndex: 10,
            height: "32px",
            width: "32px",
            borderRadius: "50%",
            backgroundColor: "white",
            border: `1px solid ${COLORS.borders}`,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: COLORS.muted,
            cursor: "pointer",
            transition: "all 200ms ease-in-out",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = COLORS.text;
            e.currentTarget.style.backgroundColor = "#f9fafb";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = COLORS.muted;
            e.currentTarget.style.backgroundColor = "white";
          }}
          aria-label="Close modal"
        >
          <X size={14} />
        </button>
      </div>

      <div
        style={{
          padding: "16px 24px 20px 24px",
          backgroundColor: `${COLORS.pageBg}99`,
          borderBottom: `1px solid ${COLORS.borders}`,
          position: "relative",
          zIndex: 10,
          width: "100%",
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            width: "100%",
            maxWidth: "768px",
            margin: "0 auto",
            paddingLeft: "16px",
            paddingRight: "16px",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "24px",
              left: "16.7%",
              right: "16.7%",
              height: "2px",
              backgroundColor: COLORS.borders,
              transform: "translateY(-50%)",
              borderRadius: "9999px",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "24px",
              left: "16.7%",
              height: "2px",
              backgroundColor: COLORS.primaryBlue,
              transform: "translateY(-50%)",
              borderRadius: "9999px",
              transition: "all 500ms cubic-bezier(0.4, 0, 0.2, 1)",
              width: step === 1 ? "0%" : step === 2 ? "33.3%" : "66.6%",
            }}
          />
          {STEPS.map((s) => {
            const isDone = s.id < step;
            const isActive = s.id === step;
            return (
              <div
                key={s.id}
                style={{
                  position: "relative",
                  zIndex: 10,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flex: 1,
                }}
              >
                <div
                  style={{
                    height: "48px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "2px solid",
                      fontSize: "12px",
                      fontWeight: "bold",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                      transition: "all 300ms ease-in-out",
                      ...(isDone
                        ? {
                            height: "40px",
                            width: "40px",
                            backgroundColor: COLORS.success,
                            borderColor: COLORS.success,
                            color: "white",
                          }
                        : isActive
                          ? {
                              height: "48px",
                              width: "48px",
                              backgroundColor: COLORS.primaryBlue,
                              borderColor: COLORS.primaryBlue,
                              color: "white",
                              boxShadow: `0 1px 3px rgba(0,0,0,0.1), 0 0 0 4px ${COLORS.primaryBlue}22`,
                              transform: "scale(1.02)",
                            }
                          : {
                              height: "40px",
                              width: "40px",
                              backgroundColor: "white",
                              borderColor: COLORS.borders,
                              color: COLORS.muted,
                            }),
                    }}
                  >
                    {isDone ? (
                      <span style={{ color: "white", fontSize: "14px" }}>✓</span>
                    ) : (
                      <span>{s.id}</span>
                    )}
                  </div>
                </div>

                <span
                  style={{
                    marginTop: "4px",
                    fontSize: "10px",
                    fontWeight: isActive ? "800" : "bold",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    transition: "color 300ms ease-in-out",
                    ...(isActive
                      ? {
                          color: COLORS.primaryBlue,
                          textDecoration: "underline",
                          textDecorationColor: `${COLORS.primaryBlue}33`,
                          textUnderlineOffset: "4px",
                        }
                      : isDone
                        ? { color: COLORS.success }
                        : { color: COLORS.muted }),
                  }}
                >
                  {s.label}
                </span>
                <span
                  style={{
                    fontSize: "9px",
                    color: COLORS.muted,
                    marginTop: "2px",
                    display: "none",
                  }}
                  className="sm:block"
                >
                  {s.desc}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scrollable Form & Live Preview Columns Container */}
      <div style={{ flex: 1, overflow: "hidden", backgroundColor: COLORS.cardBg, width: "100%" }}>
        <div className="flex flex-col lg:flex-row" style={{ width: "100%", height: "100%" }}>
          {/* Left side: Form steps (65% dynamic width) */}
          <div
            style={{
              flex: 1,
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              maxWidth: "65%",
              overflowY: "auto",
              maxHeight: "calc(100vh - 280px)",
            }}
          >
            {step === 1 && (
              <div
                style={{
                  backgroundColor: COLORS.cardBg,
                  borderRadius: "16px",
                  border: `1px solid ${COLORS.borders}`,
                  boxShadow: "0 8px 30px rgba(0,0,0,0.05)",
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                  animation: "fade-in 300ms ease-in-out",
                }}
              >
                <div style={{ marginBottom: "8px" }}>
                  <h3
                    style={{
                      fontSize: "14px",
                      fontWeight: "bold",
                      color: COLORS.text,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Personal Information
                  </h3>
                  <p style={{ fontSize: "11px", color: COLORS.muted, marginTop: "4px" }}>
                    Provide contact information and verify identification parameters.
                  </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <FormRow columns={2}>
                    <FormInput
                      label="First name"
                      required
                      placeholder="e.g. Ananya"
                      value={data.firstName}
                      error={errors.firstName}
                      onChange={(e) => {
                        setData({ ...data, firstName: e.target.value });
                        if (errors.firstName) setErrors((prev) => ({ ...prev, firstName: "" }));
                      }}
                    />
                    <FormInput
                      label="Last name"
                      required
                      placeholder="e.g. Rao"
                      value={data.lastName}
                      error={errors.lastName}
                      onChange={(e) => {
                        setData({ ...data, lastName: e.target.value });
                        if (errors.lastName) setErrors((prev) => ({ ...prev, lastName: "" }));
                      }}
                    />
                  </FormRow>

                  <FormRow columns={2} style={{ marginTop: "8px" }}>
                    <FormInput
                      type="email"
                      label="Email Address"
                      required
                      placeholder="ananya.rao@acme.com"
                      value={data.email}
                      error={errors.email}
                      helperText={
                        !errors.email
                          ? "Used for system notifications, invites & payslips."
                          : undefined
                      }
                      onChange={(e) => {
                        setData({ ...data, email: e.target.value });
                        if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
                      }}
                    />
                    <FormInput
                      label="Phone Number"
                      placeholder="+91 98765 43210"
                      value={data.phone}
                      onChange={(e) => setData({ ...data, phone: e.target.value })}
                    />
                  </FormRow>

                  <FormRow columns={1} style={{ marginTop: "8px" }}>
                    <FormInput
                      type="date"
                      label="Date of Birth"
                      value={data.dob}
                      onChange={(e) => setData({ ...data, dob: e.target.value })}
                    />
                  </FormRow>
                </div>
              </div>
            )}

            {step === 2 && (
              <div
                style={{
                  backgroundColor: COLORS.cardBg,
                  borderRadius: "16px",
                  border: `1px solid ${COLORS.borders}`,
                  boxShadow: "0 8px 30px rgba(0,0,0,0.05)",
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                  animation: "fade-in 300ms ease-in-out",
                }}
              >
                <div style={{ marginBottom: "8px" }}>
                  <h3
                    style={{
                      fontSize: "14px",
                      fontWeight: "bold",
                      color: COLORS.text,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Job Details
                  </h3>
                  <p style={{ fontSize: "11px", color: COLORS.muted, marginTop: "4px" }}>
                    Specify tracking codes, department assignments, and management hierarchy.
                  </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <FormRow columns={1}>
                    <FormInput
                      label="Job Title / Designation"
                      placeholder="e.g. HR Manager, Accountant"
                      value={data.designation}
                      onChange={(e) => setData({ ...data, designation: e.target.value })}
                    />
                  </FormRow>

                  <FormRow columns={2} style={{ marginTop: "8px" }}>
                    <FormInput
                      label="Employee Code"
                      placeholder="e.g. AMX-EMP-0142"
                      value={data.code}
                      onChange={(e) => setData({ ...data, code: e.target.value })}
                    />
                    <FormInput
                      type="date"
                      label="Hire Date"
                      required
                      value={data.hireDate}
                      error={errors.hireDate}
                      onChange={(e) => {
                        setData({ ...data, hireDate: e.target.value });
                        if (errors.hireDate) setErrors((prev) => ({ ...prev, hireDate: "" }));
                      }}
                    />
                  </FormRow>

                  <FormRow columns={2} style={{ marginTop: "8px" }}>
                    <FormSelect
                      label="Department"
                      required
                      value={data.departmentId}
                      error={errors.departmentId}
                      onChange={(e) => {
                        setData({ ...data, departmentId: e.target.value });
                        if (errors.departmentId)
                          setErrors((prev) => ({ ...prev, departmentId: "" }));
                      }}
                      options={[
                        { value: "", label: "Select Department" },
                        ...departments.map((d) => ({ value: String(d.id), label: d.name })),
                      ]}
                    />

                    <FormSelect
                      label="Reports To"
                      value={data.managerId}
                      onChange={(e) => setData({ ...data, managerId: e.target.value })}
                      options={[
                        { value: "", label: "Select Manager" },
                        ...managers.map((m) => ({
                          value: String(m.id),
                          label: `${m.name} — ${m.designation || "Lead"}`,
                        })),
                      ]}
                    />
                  </FormRow>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      marginTop: "8px",
                    }}
                  >
                    <label style={{ fontSize: "12px", fontWeight: "600", color: COLORS.text }}>
                      Employment Type <span style={{ color: COLORS.error }}>*</span>
                    </label>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "10px",
                        marginTop: "8px",
                        animation: "fade-in 300ms ease-in-out",
                      }}
                    >
                      {(
                        [
                          "Full-time",
                          "Part-time",
                          "Contract",
                          "Intern",
                        ] as Employee["contractType"][]
                      ).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setData({ ...data, employmentType: type })}
                          style={{
                            padding: "8px 20px",
                            borderRadius: "9999px",
                            fontSize: "12px",
                            fontWeight: "bold",
                            cursor: "pointer",
                            transition: "all 200ms ease-in-out",
                            ...(data.employmentType === type
                              ? {
                                  backgroundColor: COLORS.primaryBlue,
                                  color: "white",
                                  border: "none",
                                  boxShadow: "0 4px 12px rgba(31, 95, 168, 0.3)",
                                }
                              : {
                                  backgroundColor: "white",
                                  border: `1px solid ${COLORS.borders}`,
                                  color: COLORS.muted,
                                }),
                          }}
                          onMouseEnter={(e) => {
                            if (data.employmentType !== type) {
                              e.currentTarget.style.borderColor = COLORS.muted;
                              e.currentTarget.style.color = COLORS.text;
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (data.employmentType !== type) {
                              e.currentTarget.style.borderColor = COLORS.borders;
                              e.currentTarget.style.color = COLORS.muted;
                            }
                          }}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <FormRow columns={1} style={{ marginTop: "8px" }}>
                    <FormInput
                      type="number"
                      label="Monthly Salary (₹)"
                      placeholder="e.g. 65000"
                      min="0"
                      step="0.01"
                      value={data.salary}
                      error={errors.salary}
                      helperText={
                        !errors.salary
                          ? "Creates their pay contract — required before payroll can run for them."
                          : undefined
                      }
                      onChange={(e) => {
                        setData({ ...data, salary: e.target.value });
                        if (errors.salary) setErrors((prev) => ({ ...prev, salary: "" }));
                      }}
                    />
                  </FormRow>
                </div>
              </div>
            )}

            {step === 3 && (
              <div
                style={{
                  backgroundColor: COLORS.cardBg,
                  borderRadius: "16px",
                  border: `1px solid ${COLORS.borders}`,
                  boxShadow: "0 8px 30px rgba(0,0,0,0.05)",
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                  animation: "fade-in 300ms ease-in-out",
                }}
              >
                <div style={{ marginBottom: "8px" }}>
                  <h3
                    style={{
                      fontSize: "14px",
                      fontWeight: "bold",
                      color: COLORS.text,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    ERP Access Control
                  </h3>
                  <p style={{ fontSize: "11px", color: COLORS.muted, marginTop: "4px" }}>
                    Configure login capability settings and assign organizational security roles.
                  </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div
                    style={{
                      borderRadius: "12px",
                      border: `1px solid ${COLORS.borders}`,
                      backgroundColor: `${COLORS.pageBg}66`,
                      padding: "18px",
                      marginTop: "8px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "16px",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <p style={{ fontSize: "14px", fontWeight: "bold", color: COLORS.text }}>
                          Provide ERP Portal Login Access
                        </p>
                        <p
                          style={{
                            fontSize: "12px",
                            color: COLORS.muted,
                            maxWidth: "400px",
                            lineHeight: 1.5,
                          }}
                        >
                          Enable login credentials for this worker. Subordinate staff permissions
                          and logs can be reviewed manually by their manager if this remains
                          disabled.
                        </p>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={data.needsAccess}
                        onClick={() => {
                          setData({ ...data, needsAccess: !data.needsAccess, role: "" });
                          setErrors({});
                        }}
                        style={{
                          flexShrink: 0,
                          height: "24px",
                          width: "44px",
                          borderRadius: "9999px",
                          transition: "background-color 200ms ease-in-out",
                          position: "relative",
                          border: "none",
                          cursor: "pointer",
                          backgroundColor: data.needsAccess ? COLORS.primaryBlue : COLORS.muted,
                          outline: "none",
                          boxShadow: `0 0 0 4px ${data.needsAccess ? COLORS.primaryBlue : COLORS.muted}22`,
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            top: "2px",
                            left: "2px",
                            height: "20px",
                            width: "20px",
                            borderRadius: "50%",
                            backgroundColor: "white",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                            transition: "transform 200ms ease-in-out",
                            transform: data.needsAccess ? "translateX(20px)" : "translateX(0)",
                          }}
                        />
                      </button>
                    </div>

                    {/* Animated slide down role selector */}
                    <div
                      style={{
                        transition: "all 300ms cubic-bezier(0.4, 0, 0.2, 1)",
                        overflow: "hidden",
                        maxHeight: data.needsAccess ? "520px" : "0px",
                        opacity: data.needsAccess ? 1 : 0,
                        pointerEvents: data.needsAccess ? "auto" : "none",
                        marginTop: data.needsAccess ? "16px" : "0px",
                        paddingTop: data.needsAccess ? "16px" : "0px",
                        borderTop: data.needsAccess ? `1px solid ${COLORS.borders}33` : "none",
                        transform: data.needsAccess ? "translateY(0)" : "translateY(8px)",
                      }}
                    >
                      <FormRow columns={2}>
                        <FormSelect
                          label="Assign Role"
                          required
                          value={data.role}
                          error={errors.role}
                          onChange={(e) => {
                            const role = e.target.value;
                            const deptModules = defaultModulesForDepartment(
                              data.departmentId,
                              departments,
                            );
                            setData({
                              ...data,
                              role,
                              allowedModules:
                                role === "TenantAdmin"
                                  ? MODULE_OPTIONS.map((m) => m.id)
                                  : data.role === "TenantAdmin"
                                    ? deptModules
                                    : data.allowedModules.length > 0
                                      ? data.allowedModules
                                      : deptModules,
                            });
                            if (errors.role) setErrors((prev) => ({ ...prev, role: "" }));
                          }}
                          options={[
                            { value: "", label: "Select System Role" },
                            ...ROLES.map((r) => ({ value: r, label: r })),
                          ]}
                        />

                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          <label
                            style={{ fontSize: "12px", fontWeight: "600", color: COLORS.text }}
                          >
                            System Notification
                          </label>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              minHeight: "52px",
                              fontSize: "12px",
                              fontWeight: "600",
                              color: COLORS.success,
                              gap: "8px",
                              backgroundColor: COLORS.successLight,
                              border: `1px solid ${COLORS.success}44`,
                              borderRadius: "12px",
                              paddingLeft: "16px",
                              paddingRight: "16px",
                              paddingTop: "12px",
                              paddingBottom: "12px",
                            }}
                          >
                            <span style={{ fontSize: "14px", flexShrink: 0 }}>✓</span>
                            <span>System invite instructions will dispatch via email</span>
                          </div>
                        </div>
                      </FormRow>

                      <div
                        style={{
                          marginTop: "20px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "12px",
                          }}
                        >
                          <label
                            style={{ fontSize: "12px", fontWeight: "600", color: COLORS.text }}
                          >
                            ERP Module Tabs <span style={{ color: COLORS.error }}>*</span>
                          </label>
                          {data.role !== "TenantAdmin" && (
                            <button
                              type="button"
                              style={{
                                fontSize: "10px",
                                fontWeight: "600",
                                color: COLORS.primaryBlue,
                                cursor: "pointer",
                                background: "none",
                                border: "none",
                                textDecoration: "none",
                                padding: "0px",
                                transition: "text-decoration 200ms ease-in-out",
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.textDecoration = "underline")
                              }
                              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                              onClick={() =>
                                setData((prev) => ({
                                  ...prev,
                                  allowedModules: defaultModulesForDepartment(
                                    prev.departmentId,
                                    departments,
                                  ),
                                }))
                              }
                            >
                              Reset to department defaults
                            </button>
                          )}
                        </div>
                        <p style={{ fontSize: "11px", color: COLORS.muted, lineHeight: 1.5 }}>
                          Choose which sidebar sections this person can open. Home and Notifications
                          are always included.
                        </p>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                            gap: "10px",
                            marginTop: "8px",
                          }}
                        >
                          {MODULE_OPTIONS.map((opt) => (
                            <label
                              key={opt.id}
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: "10px",
                                borderRadius: "12px",
                                border: `1px solid ${data.role === "TenantAdmin" ? COLORS.borders : COLORS.borders}`,
                                padding: "14px",
                                backgroundColor:
                                  data.role === "TenantAdmin"
                                    ? `${COLORS.pageBg}80`
                                    : "transparent",
                                opacity: data.role === "TenantAdmin" ? 0.8 : 1,
                                cursor: data.role === "TenantAdmin" ? "not-allowed" : "pointer",
                                transition: "background-color 200ms ease-in-out",
                              }}
                              onMouseEnter={(e) => {
                                if (data.role !== "TenantAdmin") {
                                  e.currentTarget.style.backgroundColor = COLORS.pageBg;
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (data.role !== "TenantAdmin") {
                                  e.currentTarget.style.backgroundColor = "transparent";
                                }
                              }}
                            >
                              <input
                                type="checkbox"
                                style={{
                                  marginTop: "3px",
                                  cursor: data.role === "TenantAdmin" ? "not-allowed" : "pointer",
                                  flexShrink: 0,
                                }}
                                checked={data.allowedModules.includes(opt.id)}
                                disabled={data.role === "TenantAdmin"}
                                onChange={() => toggleModule(opt.id)}
                              />
                              <span
                                style={{ display: "flex", flexDirection: "column", gap: "3px" }}
                              >
                                <span
                                  style={{
                                    fontSize: "12px",
                                    fontWeight: "600",
                                    color: COLORS.text,
                                    display: "block",
                                  }}
                                >
                                  {opt.label}
                                </span>
                                <span
                                  style={{ fontSize: "10px", color: COLORS.muted, lineHeight: 1.4 }}
                                >
                                  {opt.description}
                                </span>
                              </span>
                            </label>
                          ))}
                        </div>
                        {errors.allowedModules && (
                          <span
                            style={{
                              fontSize: "11px",
                              color: COLORS.error,
                              fontWeight: "500",
                              marginTop: "4px",
                            }}
                          >
                            {errors.allowedModules}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {!data.needsAccess && (
                    <div
                      style={{
                        borderRadius: "12px",
                        border: `1px dashed ${COLORS.borders}`,
                        padding: "16px 18px",
                        fontSize: "12px",
                        color: COLORS.muted,
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        backgroundColor: `${COLORS.pageBg}33`,
                        marginTop: "12px",
                        lineHeight: 1.5,
                      }}
                    >
                      <span
                        style={{
                          color: COLORS.primaryBlue,
                          fontWeight: "bold",
                          fontSize: "14px",
                          lineHeight: 1,
                          marginTop: "2px",
                        }}
                      >
                        ℹ
                      </span>
                      <span>
                        No ERP credentials will be generated. The employee dashboard tracking and
                        manual attendance reporting will default to manager-controlled actions.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right side: Live preview summary block (35% dynamic width for readability) */}
          <div
            className="hidden lg:flex"
            style={{
              width: "35%",
              background: `linear-gradient(180deg, ${COLORS.pageBg}66 0%, ${COLORS.cardBg} 100%)`,
              padding: "24px 28px",
              flexDirection: "column",
              justifyContent: "space-between",
              overflowY: "auto",
              maxHeight: "calc(100vh - 280px)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <h4
                  style={{
                    fontSize: "10px",
                    fontWeight: "800",
                    color: COLORS.muted,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Live Profile Preview
                </h4>
                <p style={{ fontSize: "10px", color: COLORS.muted, marginTop: "4px" }}>
                  Summary updates instantly.
                </p>
              </div>

              {/* Employee badge preview card */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  padding: "24px",
                  backgroundColor: COLORS.cardBg,
                  borderRadius: "16px",
                  border: `1px solid ${COLORS.borders}`,
                  boxShadow: "0 6px 22px rgba(0,0,0,0.03)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "6px",
                    background: `linear-gradient(90deg, ${COLORS.primaryBlue} 0%, ${COLORS.primaryBlue}dd 100%)`,
                  }}
                />

                <div
                  style={{
                    width: "72px",
                    height: "72px",
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${COLORS.primaryBlue} 0%, ${COLORS.primaryBlue}dd 100%)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontSize: "24px",
                    fontWeight: "800",
                    boxShadow: "0 4px 12px rgba(31, 95, 168, 0.3)",
                    marginBottom: "16px",
                    transform: "scale(1)",
                    transition: "transform 300ms ease-in-out",
                    cursor: "default",
                  }}
                >
                  {initials}
                </div>

                <h4
                  style={{
                    fontSize: "15px",
                    fontWeight: "bold",
                    color: COLORS.text,
                    maxWidth: "100%",
                    lineHeight: 1.3,
                    textAlign: "center",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {nameDisplay}
                </h4>
                <p
                  style={{
                    fontSize: "12px",
                    color: COLORS.muted,
                    maxWidth: "100%",
                    marginTop: "8px",
                    fontWeight: "normal",
                    textAlign: "center",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {emailDisplay}
                </p>

                <div style={{ marginTop: "16px" }}>
                  {data.needsAccess ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        paddingLeft: "10px",
                        paddingRight: "10px",
                        paddingTop: "2px",
                        paddingBottom: "2px",
                        borderRadius: "9999px",
                        fontSize: "9px",
                        fontWeight: "bold",
                        backgroundColor: COLORS.successLight,
                        color: COLORS.success,
                        border: `1px solid ${COLORS.success}33`,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                        animation: "fade-in 300ms ease-in-out",
                      }}
                    >
                      ✓ ERP Account Requested
                    </span>
                  ) : (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        paddingLeft: "10px",
                        paddingRight: "10px",
                        paddingTop: "2px",
                        paddingBottom: "2px",
                        borderRadius: "9999px",
                        fontSize: "9px",
                        fontWeight: "bold",
                        backgroundColor: COLORS.pageBg,
                        color: COLORS.muted,
                        border: `1px solid ${COLORS.borders}`,
                      }}
                    >
                      Manual Attendance Entry
                    </span>
                  )}
                </div>
              </div>

              {/* Details layout matrix */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  backgroundColor: COLORS.cardBg,
                  padding: "20px",
                  borderRadius: "16px",
                  border: `1px solid ${COLORS.borders}33`,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  animation: "fade-in 300ms ease-in-out",
                }}
              >
                {[
                  { label: "Department", value: deptName },
                  { label: "Line Manager", value: managerName },
                  { label: "Designation", value: data.designation || "Not set" },
                  { label: "Employment Unit", value: data.employmentType },
                  {
                    label: "Monthly Salary",
                    value: data.salary
                      ? `₹${Number(data.salary).toLocaleString("en-IN")}`
                      : "Not set",
                  },
                  {
                    label: "ERP System Role",
                    value: data.needsAccess ? data.role || "Pending Role *" : "No Login Permitted",
                    highlight: true,
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "12px",
                      paddingBottom: "12px",
                      borderBottom: idx < 5 ? `1px solid ${COLORS.borders}33` : "none",
                    }}
                  >
                    <span
                      style={{
                        color: COLORS.muted,
                        fontWeight: "800",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        fontSize: "9px",
                      }}
                    >
                      {item.label}
                    </span>
                    <span
                      style={{
                        color: item.highlight ? COLORS.primaryBlue : COLORS.text,
                        fontWeight: "bold",
                        maxWidth: "140px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        textAlign: "right",
                      }}
                    >
                      {item.value}
                    </span>
                  </div>
                ))}
                {data.needsAccess && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      fontSize: "12px",
                      paddingTop: "12px",
                    }}
                  >
                    <span
                      style={{
                        color: COLORS.muted,
                        fontWeight: "800",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        fontSize: "9px",
                        flexShrink: 0,
                      }}
                    >
                      Module Tabs
                    </span>
                    <span
                      style={{
                        color: COLORS.text,
                        fontWeight: "bold",
                        textAlign: "right",
                        maxWidth: "150px",
                        lineHeight: 1.4,
                      }}
                    >
                      {moduleLabels}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 24px",
          borderTop: `1px solid ${COLORS.borders}`,
          backgroundColor: COLORS.cardBg,
          position: "relative",
          zIndex: 10,
          width: "100%",
        }}
      >
        <Button
          type="button"
          variant="outline"
          onClick={handleBack}
          disabled={step === 1}
          style={{ fontSize: "12px" }}
        >
          ← Back
        </Button>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            paddingLeft: "16px",
            paddingRight: "16px",
            paddingTop: "6px",
            paddingBottom: "6px",
            borderRadius: "9999px",
            fontSize: "12px",
            fontWeight: "800",
            color: COLORS.primaryBlue,
            backgroundColor: `${COLORS.primaryBlue}11`,
            letterSpacing: "0.05em",
          }}
        >
          Step {step} of 3
        </span>

        {step < 3 ? (
          <Button type="button" variant="primary" onClick={handleNext} style={{ fontSize: "12px" }}>
            Continue →
          </Button>
        ) : (
          <Button
            type="button"
            variant="primary"
            onClick={handleSubmit}
            disabled={loading}
            style={{ fontSize: "12px" }}
          >
            {loading ? "Saving…" : isEdit ? "✓ Update Employee" : "✓ Save Employee"}
          </Button>
        )}
      </div>
    </div>
  );
}

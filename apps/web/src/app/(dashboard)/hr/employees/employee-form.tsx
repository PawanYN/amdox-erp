"use client";

import { FormEvent, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Employee } from "@/lib/types";
import { X } from "lucide-react";

const STEPS = [
  { id: 1, label: "Personal Info", desc: "Basic details" },
  { id: 2, label: "Job Details", desc: "Role & contract" },
  { id: 3, label: "System Access", desc: "ERP login" },
];

const ROLES = ["TenantAdmin", "Manager", "Viewer"];

export function EmployeeForm({
  open,
  onClose,
  managers,
  departments,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  managers: Employee[];
  departments: any[];
  onCreate: (employee: Omit<Employee, "id" | "status">) => void;
}) {
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
    employmentType: "Full-time" as Employee["contractType"],
    needsAccess: false,
    role: "",
  });

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
      employmentType: "Full-time",
      needsAccess: false,
      role: "",
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

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }
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

    onCreate({
      name: `${data.firstName} ${data.lastName}`.trim(),
      email: data.email,
      phone: data.phone,
      department: data.departmentId,
      designation: data.role || "",
      contractType: data.employmentType,
      startDate: data.hireDate,
      reportsToId: data.managerId || null,
    });
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
  const nameDisplay = `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Add Employee Details";
  const emailDisplay = data.email || "No email provided";
  const deptName = departments.find(d => String(d.id) === String(data.departmentId))?.name || "Not assigned";
  const managerName = managers.find(m => String(m.id) === String(data.managerId))?.name || "Not assigned";

  const customInputClasses = "w-full h-[50px] bg-white rounded-xl border border-gray-200 px-4 text-sm text-gray-900 placeholder:text-gray-400/80 focus:border-brand-purple focus:outline-none focus:ring-4 focus:ring-brand-purple/10 hover:border-gray-300 transition-all duration-200";

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title=""
      description=""
      width="max-w-[1000px] w-full"
    >
      
      <style dangerouslySetInnerHTML={{
        __html: `
        [role="dialog"] .h-1.rounded-t-2xl.bg-brand-gradient {
          display: none !important;
        }
        [role="dialog"] .border-b.border-line.px-6.py-5 {
          display: none !important;
        }
        [role="dialog"] .px-6.py-5,
        [role="dialog"] div.px-6.py-5 {
          padding: 0 !important;
          border: none !important;
          background: transparent !important;
          overflow: hidden !important;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 9999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}} />

      <div className="flex flex-col bg-white rounded-2xl overflow-hidden shadow-xl max-h-[92vh] w-full">

        
        <div className="relative bg-gradient-to-r from-[#6366f1] via-[#8b5cf6] to-[#a855f7] py-3.5 px-6 md:px-8 flex items-center justify-between shadow-sm z-20 rounded-t-2xl w-full">
          
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col justify-center">
            <nav className="flex items-center text-[9px] font-bold text-white/80 uppercase tracking-widest gap-1">
              <span>HR</span>
              <span className="opacity-40">/</span>
              <span>Employees</span>
              <span className="opacity-40">/</span>
              <span className="text-white">Add Employee</span>
            </nav>
            <h2 className="text-base font-extrabold text-white mt-0.5 tracking-tight uppercase leading-none">Create Employee Profile</h2>
          </div>

          <button
            onClick={() => {
              reset();
              onClose();
            }}
            type="button"
            className="relative z-10 h-8 w-8 rounded-full bg-white border border-gray-150/20 shadow-md flex items-center justify-center text-gray-550 hover:text-gray-900 hover:bg-gray-50 active:scale-95 transition-all duration-200 cursor-pointer"
            aria-label="Close modal"
          >
            <X size={14} />
          </button>
        </div>

        
        <div className="py-2.5 px-6 md:px-8 bg-gray-50/50 border-b border-gray-200/60 relative z-10 w-full">
          <div className="relative flex items-start justify-between w-full max-w-3xl mx-auto px-4">
            
            <div className="absolute top-[24px] left-[16.7%] right-[16.7%] h-0.5 bg-gray-200/80 -translate-y-1/2 rounded-full" />
            <div
              className="absolute top-[24px] left-[16.7%] h-0.5 bg-purple-600 -translate-y-1/2 rounded-full transition-all duration-500 ease-in-out"
              style={{
                width: step === 1 ? "0%" : step === 2 ? "33.3%" : "66.6%",
              }}
            />
            {STEPS.map((s) => {
              const isDone = s.id < step;
              const isActive = s.id === step;
              return (
                <div key={s.id} className="relative z-10 flex flex-col items-center flex-1">
                  {/* Circle Wrapper - fixed height centering aligned with connector line */}
                  <div className="h-12 flex items-center justify-center">
                    <div
                      className={`rounded-full flex items-center justify-center border-2 text-xs font-bold shadow-sm transition-all duration-300 ${isDone
                          ? "h-10 w-10 bg-emerald-500 border-emerald-500 text-white"
                          : isActive
                            ? "h-12 w-12 bg-purple-600 border-purple-600 text-white ring-4 ring-purple-100/50 scale-102"
                            : "h-10 w-10 bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                        }`}
                    >
                      {isDone ? (
                        <span className="text-white text-sm">✓</span>
                      ) : (
                        <span>{s.id}</span>
                      )}
                    </div>
                  </div>

                  {/* Reduced gap between stepper number and label */}
                  <span
                    className={`mt-1 text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ${isActive
                        ? "text-purple-700 font-extrabold underline decoration-purple-200 underline-offset-4"
                        : isDone
                          ? "text-emerald-600"
                          : "text-gray-600" // Inactive labels slightly darker
                      }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scrollable Form & Live Preview Columns Container */}
        <div className="flex-1 overflow-hidden bg-white w-full">
          <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-gray-100/60 h-full">
            {/* Left side: Form steps (65% dynamic width) */}
            <div className="flex-1 p-5 space-y-4 lg:max-w-[65%] overflow-y-auto max-h-[55vh] md:max-h-[60vh] custom-scrollbar pr-2">

              {step === 1 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.05)] p-5 space-y-4 animate-fade-in transition-all">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Personal Information</h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">Provide contact information and verify identification parameters.</p>
                  </div>

                  <div className="space-y-3.5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div className="relative pb-4">
                        <label className="text-xs font-semibold text-gray-700">First name <span className="text-rose-500">*</span></label>
                        <input
                          className={`${customInputClasses} mt-1`}
                          placeholder="e.g. Ananya"
                          value={data.firstName}
                          onChange={(e) => {
                            setData({ ...data, firstName: e.target.value });
                            if (errors.firstName) setErrors(prev => ({ ...prev, firstName: "" }));
                          }}
                        />
                        {errors.firstName && (
                          <span className="absolute bottom-0 left-0 text-[10px] text-rose-550 font-medium">
                            {errors.firstName}
                          </span>
                        )}
                      </div>
                      <div className="relative pb-4">
                        <label className="text-xs font-semibold text-gray-700">Last name <span className="text-rose-500">*</span></label>
                        <input
                          className={`${customInputClasses} mt-1`}
                          placeholder="e.g. Rao"
                          value={data.lastName}
                          onChange={(e) => {
                            setData({ ...data, lastName: e.target.value });
                            if (errors.lastName) setErrors(prev => ({ ...prev, lastName: "" }));
                          }}
                        />
                        {errors.lastName && (
                          <span className="absolute bottom-0 left-0 text-[10px] text-rose-550 font-medium">
                            {errors.lastName}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div className="relative pb-4">
                        <label className="text-xs font-semibold text-gray-700">Email Address <span className="text-rose-500">*</span></label>
                        <input
                          type="email"
                          className={`${customInputClasses} mt-1`}
                          placeholder="ananya.rao@acme.com"
                          value={data.email}
                          onChange={(e) => {
                            setData({ ...data, email: e.target.value });
                            if (errors.email) setErrors(prev => ({ ...prev, email: "" }));
                          }}
                        />
                        {errors.email ? (
                          <span className="absolute bottom-0 left-0 text-[10px] text-rose-550 font-medium">
                            {errors.email}
                          </span>
                        ) : (
                          <span className="absolute bottom-0 left-0 text-[9px] text-gray-400 font-medium">
                            Used for system notifications, invites & payslips.
                          </span>
                        )}
                      </div>
                      <div className="relative pb-4">
                        <label className="text-xs font-semibold text-gray-700">Phone Number</label>
                        <input
                          className={`${customInputClasses} mt-1`}
                          placeholder="+91 98765 43210"
                          value={data.phone}
                          onChange={(e) => setData({ ...data, phone: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="relative pb-4">
                      <label className="text-xs font-semibold text-gray-700">Date of Birth</label>
                      <input
                        type="date"
                        className={`${customInputClasses} mt-1 max-w-xs text-gray-700`}
                        value={data.dob}
                        onChange={(e) => setData({ ...data, dob: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.05)] p-5 space-y-4 animate-fade-in transition-all">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Job Details</h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">Specify tracking codes, department assignments, and management hierarchy.</p>
                  </div>

                  <div className="space-y-3.5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div className="relative pb-4">
                        <label className="text-xs font-semibold text-gray-700">Employee Code</label>
                        <input
                          className={`${customInputClasses} mt-1`}
                          placeholder="e.g. AMX-EMP-0142"
                          value={data.code}
                          onChange={(e) => setData({ ...data, code: e.target.value })}
                        />
                      </div>
                      <div className="relative pb-4">
                        <label className="text-xs font-semibold text-gray-700">Hire Date <span className="text-rose-500">*</span></label>
                        <input
                          type="date"
                          className={`${customInputClasses} mt-1 text-gray-700`}
                          value={data.hireDate}
                          onChange={(e) => {
                            setData({ ...data, hireDate: e.target.value });
                            if (errors.hireDate) setErrors(prev => ({ ...prev, hireDate: "" }));
                          }}
                        />
                        {errors.hireDate && (
                          <span className="absolute bottom-0 left-0 text-[10px] text-rose-550 font-medium">
                            {errors.hireDate}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div className="relative pb-4">
                        <label className="text-xs font-semibold text-gray-700">Department <span className="text-rose-500">*</span></label>
                        <select
                          className={`w-full h-[50px] bg-white rounded-xl border border-gray-200 px-4 text-sm focus:border-brand-purple focus:outline-none focus:ring-4 focus:ring-brand-purple/10 hover:border-gray-300 transition-all duration-200 mt-1 ${data.departmentId ? "text-gray-900 font-medium" : "text-gray-400 font-normal"
                            }`}
                          value={data.departmentId}
                          onChange={(e) => {
                            setData({ ...data, departmentId: e.target.value });
                            if (errors.departmentId) setErrors(prev => ({ ...prev, departmentId: "" }));
                          }}
                        >
                          <option value="" className="text-gray-450 bg-white">Select Department</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id} className="text-gray-900 bg-white py-2 font-medium">
                              {d.name}
                            </option>
                          ))}
                        </select>
                        {errors.departmentId && (
                          <span className="absolute bottom-0 left-0 text-[10px] text-rose-550 font-medium">
                            {errors.departmentId}
                          </span>
                        )}
                      </div>

                      <div className="relative pb-4">
                        <label className="text-xs font-semibold text-gray-700">Reports To</label>
                        <select
                          className={`w-full h-[50px] bg-white rounded-xl border border-gray-200 px-4 text-sm focus:border-brand-purple focus:outline-none focus:ring-4 focus:ring-brand-purple/10 hover:border-gray-300 transition-all duration-200 mt-1 ${data.managerId ? "text-gray-900 font-medium" : "text-gray-400 font-normal"
                            }`}
                          value={data.managerId}
                          onChange={(e) => setData({ ...data, managerId: e.target.value })}
                        >
                          <option value="" className="text-gray-450 bg-white">Select Manager</option>
                          {managers.map((m) => (
                            <option key={m.id} value={m.id} className="text-gray-900 bg-white py-2 font-medium">
                              {m.name} — {m.designation || "Lead"}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="relative pb-4">
                      <label className="text-xs font-semibold text-gray-700">Employment Type <span className="text-rose-500">*</span></label>
                      <div className="flex flex-wrap gap-2.5 mt-1.5 animate-fade-in">
                        {(["Full-time", "Part-time", "Contract", "Intern"] as Employee["contractType"][]).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setData({ ...data, employmentType: type })}
                            className={`px-5 py-2 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${data.employmentType === type
                                ? "bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] text-white shadow-md shadow-purple-100 hover:brightness-105"
                                : "bg-white border border-gray-200 text-gray-500 hover:border-gray-305 hover:bg-gray-50 hover:text-gray-700"
                              }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.05)] p-5 space-y-4 animate-fade-in transition-all">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">ERP Access Control</h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">Configure login capability settings and assign organizational security roles.</p>
                  </div>

                  <div className="space-y-3.5">
                    <div className="rounded-xl border border-gray-100 bg-gray-50/40 p-4.5 mt-1">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold text-gray-900">Provide ERP Portal Login Access</p>
                          <p className="text-xs text-gray-505 max-w-md leading-relaxed">
                            Enable login credentials for this worker. Subordinate staff permissions and logs can be reviewed manually by their manager if this remains disabled.
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
                          className={`shrink-0 h-6 w-11 rounded-full transition-colors relative block cursor-pointer border border-transparent focus:outline-none focus:ring-4 focus:ring-brand-purple/20 ${data.needsAccess ? "bg-purple-650" : "bg-gray-200"
                            }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${data.needsAccess ? "translate-x-5" : "translate-x-0"
                              }`}
                          />
                        </button>
                      </div>

                      {/* Animated slide down role selector */}
                      <div
                        className={`transition-all duration-300 ease-in-out overflow-hidden ${data.needsAccess
                            ? "max-h-48 opacity-100 mt-4 pt-4 border-t border-gray-200/30 translate-y-0"
                            : "max-h-0 opacity-0 pointer-events-none translate-y-2"
                          }`}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="relative pb-4">
                            <label className="text-xs font-semibold text-gray-700">Assign Role <span className="text-rose-500">*</span></label>
                            <select
                              className={`w-full h-[50px] bg-white rounded-xl border border-gray-200 px-4 text-sm focus:border-brand-purple focus:outline-none focus:ring-4 focus:ring-brand-purple/10 hover:border-gray-300 transition-all duration-200 mt-1 ${data.role ? "text-gray-900 font-medium" : "text-gray-400 font-normal"
                                }`}
                              value={data.role}
                              onChange={(e) => {
                                setData({ ...data, role: e.target.value });
                                if (errors.role) setErrors(prev => ({ ...prev, role: "" }));
                              }}
                            >
                              <option value="" className="text-gray-400 bg-white">Select System Role</option>
                              {ROLES.map((r) => (
                                <option key={r} value={r} className="text-gray-900 bg-white py-2 font-medium">
                                  {r}
                                </option>
                              ))}
                            </select>
                            {errors.role && (
                              <span className="absolute bottom-0 left-0 text-[10px] text-rose-550 font-medium">
                                {errors.role}
                              </span>
                            )}
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-gray-700">System Notification</label>
                            <div className="flex items-center h-[50px] text-xs font-bold text-emerald-600 gap-1.5 mt-1 bg-emerald-50/50 border border-emerald-100 rounded-xl px-4">
                              <span>✓</span> System invite instructions will dispatch via email
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {!data.needsAccess && (
                      <div className="rounded-xl border border-dashed border-gray-200 p-4 text-xs text-gray-500 flex items-start gap-2 bg-gray-50/30">
                        <span className="text-purple-650 font-bold text-sm leading-none mt-0.5">ℹ</span>
                        <span>
                          No ERP credentials will be generated. The employee dashboard tracking and manual attendance reporting will default to manager-controlled actions.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right side: Live preview summary block (35% dynamic width for readability) */}
            <div className="lg:w-[35%] bg-gradient-to-b from-gray-50/40 to-white p-6 md:p-7 flex flex-col justify-between overflow-y-auto max-h-[55vh] md:max-h-[60vh] custom-scrollbar">
              <div className="space-y-4">
                <div>
                  <h4 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Live Profile Preview</h4>
                  <p className="text-[10px] text-gray-550 mt-0.5">Summary updates instantly.</p>
                </div>

                {/* Employee badge preview card */}
                <div className="flex flex-col items-center text-center p-5 bg-white rounded-2xl border border-gray-100 shadow-[0_6px_22px_rgba(0,0,0,0.03)] relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#8b5cf6] to-[#6366f1]" />

                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#8b5cf6] via-[#7c3aed] to-[#6366f1] flex items-center justify-center text-white text-xl font-extrabold shadow-md mb-3 transform hover:scale-105 duration-300 transition-transform">
                    {initials}
                  </div>

                  <h4 className="text-sm font-bold text-gray-900 truncate max-w-full leading-tight font-sans text-center">{nameDisplay}</h4>
                  <p className="text-xs text-gray-500 truncate max-w-full mt-1.5 font-normal text-center">{emailDisplay}</p>

                  <div className="mt-3">
                    {data.needsAccess ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/50 shadow-sm animate-fade-in">
                        ✓ ERP Account Requested
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                        Manual Attendance Entry
                      </span>
                    )}
                  </div>
                </div>

                {/* Details layout matrix */}
                <div className="space-y-2.5 bg-white p-4.5 rounded-2xl border border-gray-200/50 shadow-sm animate-fade-in">
                  <div className="flex justify-between items-center text-xs pb-2.5 border-b border-gray-100/50">
                    <span className="text-gray-400 font-extrabold uppercase tracking-wider text-[9px]">Department</span>
                    <span className="text-gray-950 font-bold max-w-[140px] truncate text-right">{deptName}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs pb-2.5 border-b border-gray-100/50">
                    <span className="text-gray-400 font-extrabold uppercase tracking-wider text-[9px]">Line Manager</span>
                    <span className="text-gray-950 font-bold max-w-[140px] truncate text-right">{managerName}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs pb-2.5 border-b border-gray-100/50">
                    <span className="text-gray-400 font-extrabold uppercase tracking-wider text-[9px]">Employment Unit</span>
                    <span className="text-gray-950 font-bold text-right">{data.employmentType}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400 font-extrabold uppercase tracking-wider text-[9px]">ERP System Role</span>
                    <span className="text-purple-650 font-extrabold text-right truncate max-w-[130px]">
                      {data.needsAccess ? (data.role || "Pending Role *") : "No Login Permitted"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Decorative mini branding hint */}
              <div className="mt-5 pt-3.5 border-t border-gray-150/40 flex items-center justify-between text-[9px] text-gray-400 font-medium">
                <span>Enterprise Suite v2.4</span>
                <span>Active Profile</span>
              </div>
            </div>
          </div>
        </div>

        {/* Custom Premium Footer Controls */}
        <div className="flex items-center justify-between py-4 px-6 md:px-8 border-t border-gray-200/50 bg-white rounded-b-2xl shadow-md relative z-10 w-full">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 1}
            className="group px-6 py-2.5 rounded-xl text-xs font-bold border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none transition-all duration-200 cursor-pointer flex items-center gap-1.5"
          >
            <span className="inline-block transition-transform duration-200 group-hover:-translate-x-1">&larr;</span>
            Back
          </button>

          <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-extrabold text-purple-700 bg-purple-50 tracking-wider">
            Step {step} of 3
          </span>

          {step < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              className="group px-7 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] text-white shadow-[0_4px_16px_rgba(124,58,237,0.35)] hover:brightness-105 hover:shadow-[0_6px_22px_rgba(124,58,237,0.5)] hover:-translate-y-0.5 active:scale-95 transition-all duration-200 cursor-pointer flex items-center gap-1.5"
            >
              Continue
              <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">&rarr;</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              className="group px-7 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] text-white shadow-[0_4px_16px_rgba(124,58,237,0.35)] hover:brightness-105 hover:shadow-[0_6px_22px_rgba(124,58,237,0.5)] hover:-translate-y-0.5 active:scale-95 transition-all duration-200 cursor-pointer flex items-center gap-1.5"
            >
              ✓ Save Employee
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
